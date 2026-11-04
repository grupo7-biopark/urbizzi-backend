# Módulo plantas

Planta humanizada exibida no mapa (RF26, RF27). Recebe a planta enviada pela Urbizzi como imagem única ou como fatias em grade e guarda os originais no armazenamento S3. Depois, um worker processa a planta em uma pirâmide de tiles, e o módulo serve a planta ativa e os tiles dela ao mapa (RF31).

## Modelo de domínio

- `Planta`: `nome` (até 150 caracteres), `versao` (sequencial a partir de 1), `status` (`ENVIADA`, `PROCESSANDO`, `PRONTA`, `ERRO`), `ativa`, grade (`gradeLinhas` x `gradeColunas`), chaves dos `originais` e os metadados preenchidos pelo processamento (`larguraPx`, `alturaPx`, `maxZoom`, `tilesPath`). Não usa soft delete: as versões antigas ficam no histórico.
- `GradeFatias`: valida e ordena a imagem única ou as fatias enviadas.
- `calcularPiramide` (`piramide-tiles.entity.ts`): níveis de zoom e quantidade de tiles por nível.
- Porta `ProcessadorImagem` (`domain/repositories`), implementada com sharp/libvips em `infra/repositories/sharp-processador-imagem.ts`.
- `PlantasWorker` (`infra/workers`): consome a fila de processamento (ver [arquitetura](../../../docs/architecture.md#trabalho-em-segundo-plano)).

## Regras de negócio

1. Um único arquivo com qualquer nome é uma imagem única (grade 1 x 1).
2. Com dois ou mais arquivos, todos devem se chamar `fatia_LL_CC.<ext>`, com linha (`LL`) e coluna (`CC`) de dois dígitos começando em `01`. A grade tem tantas linhas e colunas quanto o maior `LL` e o maior `CC` enviados.
3. A grade precisa estar completa; a resposta `400 PLANTA_GRADE_INCOMPLETA` lista as fatias faltantes em `details`. Duas imagens na mesma posição retornam `400 PLANTA_FATIA_DUPLICADA`.
4. Todas as fatias têm as mesmas dimensões, em pixels.
5. Só PNG e JPEG são aceitos. O formato e as dimensões são lidos do conteúdo do arquivo, não da extensão nem do MIME enviado.
6. A planta completa tem no máximo 268.402.689 pixels (o limite padrão do libvips). A planta real tem cerca de 138 megapixels.
7. Cada arquivo tem até 300 MB, e o envio tem até 100 arquivos (grade de 10 x 10). Acima do tamanho, a resposta é `413 ARQUIVO_MUITO_GRANDE`.
8. O upload é gravado em disco temporário e enviado ao bucket `plantas-originais` em streaming, sem carregar os arquivos na memória. Os temporários são apagados ao fim da requisição, com sucesso ou erro.
9. As chaves dos originais são geradas pelo servidor: `plantas/<id>/imagem.<ext>` ou `plantas/<id>/fatia_LL_CC.<ext>`. O nome enviado pelo usuário não entra no caminho.
10. A planta nasce `ENVIADA`, inativa e com a próxima versão. A numeração usa um advisory lock na transação, então envios simultâneos recebem versões diferentes.
11. Se a gravação no banco falhar, os originais já enviados são removidos do bucket.
12. O envio é auditado na mesma transação da criação (`entidadeTipo: 'Planta'`, ação `CRIAR`), com nome, versão, status, ativa e grade.

### Processamento em tiles (BE-31)

13. A fila é a própria tabela `plantas`. O worker retira a planta `ENVIADA` mais antiga e a marca como `PROCESSANDO` numa operação atômica (`FOR UPDATE SKIP LOCKED`), então cada planta é processada uma vez, mesmo com várias instâncias. Processa uma planta por vez.
14. O worker baixa os originais para uma pasta temporária e junta as fatias em faixas com o libvips, sem montar a imagem inteira na memória. Em seguida gera a pirâmide de tiles WebP (qualidade 85) de 256 x 256 px.
15. A pirâmide segue o layout "google": no zoom máximo a imagem tem o tamanho original, e cada nível abaixo tem a metade. O zoom 0 é um único tile, e os tiles das bordas são completados com branco. É compatível com Leaflet em `CRS.Simple`, com a origem no canto superior esquerdo.
16. Os tiles vão para o bucket `plantas-tiles` em `plantas/<id>/<z>/<x>/<y>.webp`, com até 8 envios simultâneos. A falta de qualquer tile esperado pela pirâmide é erro.
17. Ao terminar, a planta fica `PRONTA` com `larguraPx`, `alturaPx`, `maxZoom`, `tamanhoTile` e `tilesPath` (`plantas/<id>`). A pasta temporária é apagada com sucesso ou erro.
18. Se falhar, a planta fica `ERRO`, com uma mensagem em `mensagemErro`. A mensagem é genérica e não traz detalhes internos, que vão só para o log.
19. Uma planta `PROCESSANDO` há mais de 30 minutos é considerada interrompida (ex.: a API reiniciou no meio) e passa a `ERRO`.
20. Só uma planta `ERRO` pode ser reprocessada (`409 PLANTA_NAO_REPROCESSAVEL` nos outros status). Ela volta a `ENVIADA`, e a ação fica auditada (`REPROCESSAR`).
21. O processamento automático não é auditado, porque é ação do sistema. O status e a mensagem de erro ficam na própria planta.

### Planta ativa e tiles (BE-32)

22. Só uma planta fica ativa por vez. Ao ativar uma, a anterior é desativada na mesma transação. Um advisory lock serializa ativações simultâneas, e o índice parcial `plantas_ativa_key` garante a regra no banco.
23. Só uma planta `PRONTA` pode ser ativada (`409 PLANTA_NAO_PRONTA`). Ativar a planta que já está ativa não muda nada.
24. A ativação é auditada: `ATIVAR` na nova e `DESATIVAR` na anterior. As versões anteriores continuam consultáveis.
25. `GET /v1/plantas/ativa` devolve a planta ativa com `tilesUrl`, o modelo de URL para o `L.tileLayer` do Leaflet. O frontend usa `CRS.Simple`, `maxNativeZoom = maxZoom`, `tileSize = tamanhoTile` e limites de `larguraPx` x `alturaPx` no zoom máximo.
26. Os tiles são servidos pela API (proxy em streaming do bucket), não por URL assinada nem redirect. Assim, o modelo de URL é fixo e cacheável e funciona igual no mapa interno e no link público (BE-38), sem expor o armazenamento.
27. A rota de tiles é pública (sem token, ver [segurança](../../../docs/security.md#rotas-públicas)) e responde `Cache-Control: public, max-age=31536000, immutable`. Os tiles de uma planta `PRONTA` nunca mudam. Respostas de erro não levam esse header.
28. Só plantas `PRONTA` têm tiles. Coordenadas fora da pirâmide retornam `404 TILE_NAO_ENCONTRADO` sem consultar o armazenamento, e parâmetros inválidos retornam `400 DADOS_INVALIDOS`.

Medição local com uma planta do tamanho da real (9 fatias de 4404 x 3482 px, 13212 x 10446 px no total, 2.880 tiles): 86 s de processamento e pico de cerca de 100 MB a mais de memória no processo, com o `/health` respondendo em no máximo 217 ms durante o processamento.

## Endpoints

| Método | Rota | Perfis | Descrição |
| --- | --- | --- | --- |
| `POST` | `/v1/plantas` | ADMINISTRADOR, GESTOR | envia a planta (multipart: `nome` e `arquivos`) |
| `GET` | `/v1/plantas` | todos os autenticados | lista paginada, da versão mais recente para a mais antiga; filtro `status` (vários, separados por vírgula) |
| `GET` | `/v1/plantas/:id` | todos os autenticados | detalha a planta, com o status do processamento |
| `POST` | `/v1/plantas/:id/reprocessar` | ADMINISTRADOR, GESTOR | devolve uma planta com `ERRO` para a fila |
| `GET` | `/v1/plantas/ativa` | todos os autenticados | planta ativa, com metadados e `tilesUrl` |
| `POST` | `/v1/plantas/:id/ativar` | ADMINISTRADOR, GESTOR | ativa uma planta `PRONTA` e desativa a anterior |
| `GET` | `/v1/plantas/:id/tiles/:z/:x/:y.webp` | pública | tile WebP de uma planta `PRONTA`, com cache longo |

## Códigos de erro

| code | HTTP | Quando |
| --- | --- | --- |
| `ARQUIVO_OBRIGATORIO` | 400 | nenhum arquivo no campo `arquivos` |
| `PLANTA_FORMATO_INVALIDO` | 400 | arquivo que não é PNG nem JPEG (lista em `details`) |
| `PLANTA_NOME_FATIA_INVALIDO` | 400 | vários arquivos e algum fora do padrão `fatia_LL_CC` |
| `PLANTA_FATIA_DUPLICADA` | 400 | dois arquivos para a mesma posição |
| `PLANTA_GRADE_INCOMPLETA` | 400 | faltam fatias na grade (lista em `details`) |
| `PLANTA_FATIAS_DIMENSOES_DIFERENTES` | 400 | fatias com dimensões diferentes da `fatia_01_01` |
| `ARQUIVO_MUITO_GRANDE` | 413 | arquivo acima de 300 MB |
| `PLANTA_MUITO_GRANDE` | 422 | imagem completa acima do limite de pixels |
| `PLANTA_NAO_ENCONTRADA` | 404 | id inexistente |
| `PLANTA_NAO_REPROCESSAVEL` | 409 | reprocessar planta que não está com `ERRO` |
| `PLANTA_NAO_PRONTA` | 409 | ativar planta que não está `PRONTA` |
| `PLANTA_ATIVA_NAO_ENCONTRADA` | 404 | nenhuma planta ativa |
| `TILE_NAO_ENCONTRADO` | 404 | planta inexistente ou não pronta, ou coordenada fora da pirâmide |

## Dependências

- Importa `AuditoriaModule` (`AuditoriaService.registrar`) e `StorageModule` (contrato `Storage`, buckets `originais` e `tiles`).
- Configuração: `PLANTAS_PROCESSAMENTO_ATIVO` (padrão `true`) e `PLANTAS_FILA_INTERVALO_MS` (padrão `5000`).
- Exporta `PlantaService` (consumido por mapa na BE-33 para validar a existência da planta).
- Não emite nem consome eventos.
