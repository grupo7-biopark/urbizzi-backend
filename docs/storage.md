# Armazenamento de arquivos (BE-29)

Plantas originais e tiles ficam no armazenamento S3, nunca no Postgres. `StorageService` usa AWS SDK v3 e pode acessar Garage ou outro provedor compatível trocando configuração.

## Ambiente local

```bash
cp .env.example .env
docker compose up --build
```

O compose inicia Postgres, Garage e API. O Garage usa a versão fixa 2.3.0 e um nó com SQLite, layout automático e volumes `garage_meta` e `garage_data`. O script `docker/garage/init.sh` inicia o servidor com `--single-node --default-access-key`, aguarda RPC, cria os buckets ausentes e concede leitura/escrita à chave configurada. Ele é idempotente e não registra credenciais. O healthcheck só passa após concluir esse setup; a API aguarda Garage e Postgres saudáveis.

Os buckets padrão são `plantas-originais` e `plantas-tiles`, privados. A chave não recebe permissão de administrar ou excluir buckets; a permissão de criar buckets do padrão Garage é removida pelo script após o setup. S3 fica em `127.0.0.1:3900`; RPC não é publicado no host. Os valores de chave e segredo do compose e `.env.example` são fictícios e exclusivos do ambiente local. Fora do compose, a aplicação exige credenciais explícitas, inclusive em produção.

```bash
docker compose up -d --build --wait garage
docker compose exec garage /garage status
docker compose exec garage /garage bucket list
docker compose restart garage
```

Restart ou `docker compose down` preservam os volumes. `docker compose down -v` apaga os dados. O modo de nó único é para desenvolvimento: não fornece redundância. Deploys precisam de backup, TLS e um provedor/cluster apropriado; o compose não é um modelo de produção.

## Configuração

| Variável | Padrão da aplicação | Uso |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://localhost:3900` | Endpoint para upload, download, exclusão e listagem |
| `S3_PUBLIC_ENDPOINT` | mesmo que S3_ENDPOINT | Endpoint usado para assinar URLs que o destinatário consegue acessar |
| `S3_REGION` | `garage` | Região esperada pelo provedor; corresponde ao garage.toml local |
| `S3_FORCE_PATH_STYLE` | `true` | String `true` ou `false`; false usa bucket no hostname |
| `S3_ACCESS_KEY_ID` | obrigatório, sem padrão | Chave de acesso do provedor |
| `S3_SECRET_ACCESS_KEY` | obrigatório, sem padrão | Segredo da chave |
| `S3_BUCKET_ORIGINAIS` | `plantas-originais` | Bucket de arquivos originais |
| `S3_BUCKET_TILES` | `plantas-tiles` | Bucket de tiles |
| `S3_URL_EXPIRES_IN` | `900` | Segundos; intervalo permitido 1 a 604800 |
| `GARAGE_RPC_SECRET` | valor fictício no compose local | Segredo RPC hexadecimal de 32 bytes do Garage |
| `GARAGE_S3_PORT` | `3900` no compose | Porta S3 publicada no host |

Dentro do compose, `S3_ENDPOINT` é `http://garage:3900`. Para o navegador no host, `S3_PUBLIC_ENDPOINT` é `http://localhost:3900`. Caso altere a porta ou acesse por outro computador, configure o endereço público correspondente. A URL é assinada com esse host desde o início: não altere o hostname de uma URL já assinada.

Para outro S3, configure endpoint, região, credenciais, buckets e forcePathStyle conforme o provedor; os buckets devem ser provisionados nele. O Garage local permanece opcional nesse cenário: rode a API fora do compose ou adapte seu serviço de deploy. Nenhum trecho do StorageService conhece a API administrativa do Garage. Os checksums opcionais são configurados como WHEN_REQUIRED para interoperabilidade; TLS e as garantias de integridade do provedor continuam aplicáveis.

## Uso nos módulos

Importe `StorageModule`. Na camada application, injete `STORAGE` com o contrato `Storage` de `shared/application/storage/storage.interface.ts`; assim o service de domínio não depende de AWS SDK ou da infraestrutura. `StorageService` também é exportado para consumidores de infraestrutura. Este recurso não adiciona endpoints HTTP; limites de upload, validação de MIME e autorização ficam nos futuros módulos consumidores (BE-30 em diante).

```ts
import { Inject, Injectable } from '@nestjs/common';
import { STORAGE, type Storage } from '../../../../shared/application/storage/storage.interface.js';
import { createStorageKey } from '../../../../shared/application/storage/storage-key.js';

@Injectable()
export class ExemploService {
  constructor(@Inject(STORAGE) private readonly storage: Storage) {}

  async enviar(conteudo: Buffer): Promise<string> {
    const key = createStorageKey('plantas/id-da-planta', 'pdf');
    await this.storage.upload({ bucket: 'originais', key, body: conteudo, contentType: 'application/pdf' });
    return key;
  }
}
```

- `upload({ bucket, key, body, contentType? })`: aceita Buffer ou Readable; usa AWS Upload, com partes de 8 MiB e duas partes simultâneas. Arquivos grandes e streams de tamanho desconhecido usam multipart; falhas tentam abortar partes pendentes. O padrão de MIME é application/octet-stream.
- `download(bucket, key)`: devolve Readable, sem carregar todo o conteúdo em memória. O consumidor precisa consumir ou destruir o stream e tratar seus eventos de erro.
- `delete(bucket, key)`: remove um objeto; operação idempotente.
- `list(bucket, prefix, { limit?, continuationToken? })`: devolve `{ items, continuationToken }`. Limite padrão 100, máximo 1000; repasse o cursor até receber null. É paginação técnica do S3, sem contagem total nem endpoint HTTP; endpoints futuros devem seguir os DTOs paginados da API.
- `getSignedUrl(bucket, key, expiresIn?)`: assina GET privado com validade limitada. O destinatário não recebe a chave secreta; a própria URL concede acesso temporário e não deve ser registrada em logs.

`bucket` aceita somente `originais` ou `tiles`, mapeados aos nomes configurados. `createStorageKey(prefix, extension)` gera UUID e extensão normalizada no servidor, evitando nomes enviados pelo usuário. Rejeita segmentos `.`/`..`, caminhos absolutos, barras invertidas, controles e chaves maiores que 1024 bytes. Prefixos são definidos pelo servidor; não inclua nomes de pessoas ou documentos nas chaves. Tiles determinísticos podem usar chaves como `plantas/<id>/<z>/<x>/<y>.png`.

Erros de validação são `BusinessRuleError`: CHAVE_ARQUIVO_INVALIDA, EXTENSAO_ARQUIVO_INVALIDA, BUCKET_INVALIDO, LIMITE_ARQUIVOS_INVALIDO e VALIDADE_URL_INVALIDA. Arquivo ausente gera `NotFoundError` com ARQUIVO_NAO_ENCONTRADO. Outras falhas do provedor são propagadas com mensagem genérica, sem endpoint, credenciais, chave ou URL assinada. O serviço não registra corpos de arquivos nem segredos.

## Testes

Copie as credenciais fictícias de `.env.example` para `.env` e suba Garage e Postgres:

```bash
docker compose up -d --build --wait garage postgres
npm run db:deploy
npm run test:e2e
```

Para apenas armazenamento:

```bash
npx vitest run --config vitest.config.e2e.ts test/storage/storage.e2e-spec.ts
```

A integração verifica multipart real de 32 MiB com quatro partes, SHA-256 do download em stream, URL assinada, chaves com espaços/acentos/caracteres reservados, buckets privados, paginação por prefixo e exclusão. Os testes removem somente os objetos do seu prefixo aleatório; não esvaziam buckets. A suíte completa também limpa o banco de teste: nunca use dados de produção. O CI sobe o Garage do compose antes dos e2e.

## Referências

- [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) e [configuração](https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/).
- [AWS SDK v3 S3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/) e [URLs assinadas](https://aws.amazon.com/blogs/developer/generate-presigned-url-modular-aws-sdk-javascript/).
