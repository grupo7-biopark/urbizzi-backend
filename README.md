# Urbizzi Backend

API do Urbizzi construída com [NestJS](https://docs.nestjs.com) (TypeScript `strict`, ESM), [Prisma ORM](https://www.prisma.io/docs) e PostgreSQL, rodando em containers Docker.

## Requisitos

- [Docker](https://docs.docker.com/get-docker/) com Docker Compose v2.24+
- [Node.js](https://nodejs.org) 24+ e npm (apenas para rodar comandos fora do container: lint, testes, Prisma CLI)

## Subindo o ambiente (do zero)

```bash
git clone https://github.com/grupo7-biopark/urbizzi-backend.git
cd urbizzi-backend
cp .env.example .env        # configure JWT_SECRET antes de iniciar
docker compose up --build
```

Isso sobe três serviços:

| Serviço    | Descrição                                                        | Porta  |
| ---------- | ---------------------------------------------------------------- | ------ |
| `garage` | Armazenamento S3 local; layout, chave e buckets criados automaticamente | `3900` |
| `postgres` | PostgreSQL 17 com volume persistente (`postgres_data`) e healthcheck | `5432` |
| `api`      | API NestJS em modo desenvolvimento com hot reload                 | `3000` |

A API só inicia depois que Postgres e Garage estiverem saudáveis, aplica as migrations pendentes (`prisma migrate deploy`) e fica observando alterações em `src/`.

Depois de subir:

- Health check: <http://localhost:3000/health>
- Documentação Swagger: <http://localhost:3000/docs> (JSON em `/docs-json`)

Para parar: `docker compose down` (adicione `-v` para apagar os dados do banco).

## Variáveis de ambiente

Todas estão documentadas em [`.env.example`](.env.example). As variáveis da aplicação são validadas na inicialização (`src/config/env.validation.ts`, com Zod via `@nestjs/config`); se alguma obrigatória faltar ou for inválida, a aplicação não inicia e mostra quais variáveis estão com problema:

```
Error: Variáveis de ambiente inválidas:
  - DATABASE_URL: variável obrigatória não definida
```

| Variável            | Obrigatória | Padrão        | Descrição                                   |
| ------------------- | ----------- | ------------- | ------------------------------------------- |
| `S3_ENDPOINT` | não | `http://localhost:3900` | Endpoint S3 (http://garage:3900 no compose) |
| `S3_PUBLIC_ENDPOINT` | não | mesmo endpoint | Endereço usado nas URLs assinadas |
| `S3_REGION` | não | `garage` | Região S3 |
| `S3_FORCE_PATH_STYLE` | não | `true` | Endereçamento por caminho, string true/false |
| `S3_ACCESS_KEY_ID` | sim | - | Chave S3; valor fictício no compose local |
| `S3_SECRET_ACCESS_KEY` | sim | - | Segredo S3; valor fictício no compose local |
| `S3_BUCKET_ORIGINAIS` | não | `plantas-originais` | Bucket de originais |
| `S3_BUCKET_TILES` | não | `plantas-tiles` | Bucket de tiles |
| `S3_URL_EXPIRES_IN` | não | `900` | Validade das URLs em segundos (até 604800) |
| `GARAGE_RPC_SECRET` | compose | fictício local | Segredo RPC hexadecimal de 32 bytes |
| `GARAGE_S3_PORT` | não | `3900` | Porta S3 do Garage no host |
| `JWT_SECRET` | sim | - | Segredo HS256 com no mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | não | `900` | Validade do access token em segundos (60 a 3600) |
| `REFRESH_TOKEN_EXPIRES_IN` | não | `604800` | Validade do refresh em segundos (3600 a 2592000) |
| `DATABASE_URL`      | sim         | —             | URL de conexão PostgreSQL usada pelo Prisma |
| `NODE_ENV`          | não         | `development` | `development`, `production` ou `test`       |
| `PORT`              | não         | `3000`        | Porta HTTP da API                           |
| `POSTGRES_USER`     | não         | `urbizzi`     | Usuário do Postgres (docker-compose)        |
| `POSTGRES_PASSWORD` | não         | `urbizzi`     | Senha do Postgres (docker-compose)          |
| `POSTGRES_DB`       | não         | `urbizzi`     | Banco do Postgres (docker-compose)          |
| `POSTGRES_PORT`     | não         | `5432`        | Porta do Postgres exposta no host           |

> Dentro do compose, `DATABASE_URL` é montada automaticamente apontando para o serviço `postgres`. O valor do `.env` (com `localhost`) é usado quando a API ou os testes rodam fora do Docker.

> **Já tem um PostgreSQL instalado na máquina?** Ele provavelmente ocupa a porta `5432` e os testes/`start:dev` acabam conectando nele (erro de autenticação ou `/health` com 503). Troque `POSTGRES_PORT` para `5433` no `.env` e ajuste a porta em `DATABASE_URL` (`localhost:5433`).

## Desenvolvimento local (fora do Docker)

```bash
npm install                 # também roda `prisma generate`
docker compose up -d garage postgres
npm run start:dev
```

## Scripts

| Script                 | Descrição                                       |
| ---------------------- | ----------------------------------------------- |
| `npm run start:dev`    | API com hot reload                              |
| `npm run build`        | Compila para `dist/`                            |
| `npm run start:prod`   | Executa o build compilado                       |
| `npm run lint`         | Lint com [oxlint](https://oxc.rs/docs/guide/usage/linter) |
| `npm run format`       | Formata o código com Prettier                   |
| `npm test`             | Testes unitários ([Vitest](https://vitest.dev)) |
| `npm run test:e2e`     | Testes e2e (precisam do Postgres rodando)       |
| `npm run test:cov`     | Testes unitários com cobertura (mínimo 80% em `domain/` e `application/`) |
| `npm run db:generate`  | Gera o Prisma Client em `src/generated/prisma`  |
| `npm run db:migrate`   | Cria/aplica migrations em desenvolvimento       |
| `npm run db:deploy`    | Aplica migrations pendentes (CI/produção)       |

Para rodar comandos dentro do container: `docker compose exec api npm run db:migrate`.

## Integração contínua

Todo Pull Request e todo push na `main` rodam o workflow [CI](.github/workflows/ci.yml) no GitHub Actions: lint, formatação, build e testes unitários com cobertura em um job, e testes e2e contra um Postgres próprio em outro. Detalhes em [docs/testing.md](docs/testing.md#integração-contínua).

## Imagem de produção

O `Dockerfile` é multi-stage. O target `development` é usado pelo compose; o target `production` gera uma imagem enxuta só com dependências de runtime e o `dist/`:

```bash
docker build --target production -t urbizzi-backend .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgresql://... -e JWT_SECRET=<segredo-aleatorio> -e S3_ENDPOINT=https://... -e S3_ACCESS_KEY_ID=... -e S3_SECRET_ACCESS_KEY=... urbizzi-backend
```

A imagem de produção não inclui o Prisma CLI; as migrations devem ser aplicadas no pipeline de deploy com `npm run db:deploy`.

Setup, operações e testes de arquivos: [docs/storage.md](docs/storage.md). Fora do compose, configure as credenciais S3 de `.env.example` antes de iniciar a API.

## Arquitetura e padrões

O backend é um **monolito modular**. Antes de contribuir (pessoa ou IA), leia o [AGENTS.md](AGENTS.md) e a documentação em [`docs/`](docs):

- [Arquitetura](docs/architecture.md): módulos, camadas, comunicação entre módulos e exemplo completo de módulo
- [Convenções](docs/conventions.md): nomenclatura, idioma, commits e branches
- [Padrões da API](docs/api-standards.md): REST, versionamento (`/v1`), paginação, filtros, formato de erro e Swagger
- [Banco de dados](docs/database.md): Prisma, migrations, uuid, timestamps, soft delete e transações
- [Testes](docs/testing.md): unitários, e2e, factories e cobertura
- [Segurança](docs/security.md): autenticação, autorização por perfil, LGPD e segredos

## Estrutura

```
prisma/              schema e migrations do Prisma
prisma7.config.ts    configuração do Prisma CLI
src/
  config/            validação das variáveis de ambiente
  modules/           módulos de domínio (application / domain / infra)
  shared/            código transversal: erros, paginação, Prisma, filtro de erros, Swagger, health
  app.setup.ts       versionamento, ValidationPipe, filtro de erros e Swagger
  main.ts            bootstrap
test/                testes e2e
docs/                arquitetura e padrões
```

> Alterou `package.json`, `nest-cli.json`, moveu/renomeou arquivos em `src/` ou o hot reload parou de refletir mudanças? Reconstrua o container: `docker compose up -d --build api`.
