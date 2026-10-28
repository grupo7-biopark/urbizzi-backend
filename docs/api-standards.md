# Padrões da API

## REST

| Operação | Método e rota | Sucesso | Corpo da resposta |
| --- | --- | --- | --- |
| Listar | `GET /v1/lotes` | 200 | `PaginatedDto<LoteDto>` |
| Detalhar | `GET /v1/lotes/:id` | 200 | `LoteDto` |
| Criar | `POST /v1/lotes` | 201 | `LoteDto` criado |
| Atualizar parcialmente | `PATCH /v1/lotes/:id` | 200 | `LoteDto` atualizado |
| Excluir | `DELETE /v1/lotes/:id` | 204 | vazio |
| Ação de negócio | `POST /v1/reservas/:id/renovar` | 200 (ou 201 se cria um recurso) | DTO do recurso afetado |

- Não use `PUT`: atualizações são parciais, com `PATCH`.
- Recursos no plural, em português, `kebab-case`. Identificadores são uuid e validados com `ParseUUIDPipe`.
- Aninhe no máximo um nível, e só quando o filho não existe sem o pai: `GET /v1/loteamentos/:loteamentoId/quadras`. Para o resto, prefira rota plana com filtro: `GET /v1/lotes?quadraId=...`.
- Ações de negócio usam `POST` com o verbo no infinitivo depois do id: `/aprovar`, `/rejeitar`, `/cancelar`, `/bloquear`, `/desbloquear`, `/renovar`. O corpo carrega só os dados da ação (ex.: `{ "motivo": "..." }`).
- JSON com campos em `camelCase`. Campos sem valor saem como `null` (não omita).
- Datas em ISO 8601 UTC (`2026-10-28T12:00:00.000Z`). Datas sem hora (ex.: feriado): `YYYY-MM-DD`.
- Valores monetários como **string decimal** com duas casas (`"250000.00"`), para não perder precisão.
- Respostas nunca expõem registros do Prisma, `senhaHash`, tokens ou campos internos.

## Versionamento

- Versionamento por URI, configurado em `src/app.setup.ts` com `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`. Todo controller responde em `/v1/...` sem precisar declarar nada.
- `GET /health` e `/docs` não são versionados (`VERSION_NEUTRAL`).
- Mudanças **compatíveis** (novo campo na resposta, novo endpoint, novo filtro opcional) entram na versão atual.
- Mudanças **incompatíveis** (remover/renomear campo, mudar tipo, mudar semântica, novo campo obrigatório na entrada) exigem nova versão da rota: `@Version('2')` no método ou `@Controller({ path, version: '2' })`, mantendo a v1 até o front-end migrar.

## Paginação

Toda listagem é paginada.

- Query: `page` (padrão 1, mínimo 1) e `pageSize` (padrão 20, mínimo 1, máximo 100).
- O DTO de listagem estende `PaginationQueryDto` (`src/shared/application/dto/pagination-query.dto.ts`).
- O repositório recebe `Pagination`, usa `toSkipTake()` e devolve `Page<Entidade>` (`{ items, total }`).
- O service devolve `PaginatedDto.of({ items, total }, { page, pageSize })`.
- O controller documenta com `@ApiPaginatedResponse(ItemDto)`.

```http
GET /v1/lotes?page=2&pageSize=20&status=DISPONIVEL
```

```json
{
  "data": [
    { "id": "0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10", "numero": "12", "status": "DISPONIVEL" }
  ],
  "meta": { "page": 2, "pageSize": 20, "total": 57, "totalPages": 3 }
}
```

Página além da última retorna `200` com `data: []`.

## Filtros e ordenação

- Filtro por igualdade: o nome do campo (`?status=DISPONIVEL`, `?quadraId=...`).
- Vários valores para o mesmo campo: separados por vírgula (`?status=DISPONIVEL,RESERVADO`). No DTO, use `@Transform(({ value }) => String(value).split(','))` + `@IsEnum(StatusLote, { each: true })`.
- Busca textual: `q` (ex.: nome do cliente ou número do documento), sem diferenciar maiúsculas.
- Intervalos: sufixos `De` e `Ate` (`?dataVencimentoDe=2026-11-01&dataVencimentoAte=2026-11-30`), ambos inclusivos.
- Booleanos: `true`/`false` (`?ativo=true`), convertidos com `@Transform`.
- Ordenação: `orderBy=<campo>&order=asc|desc`. Cada endpoint declara no DTO a lista de campos permitidos com `@IsIn([...])`. Padrão: `createdAt` decrescente.
- Filtro desconhecido gera `400 DADOS_INVALIDOS` (o `ValidationPipe` usa `forbidNonWhitelisted`).

## Formato de erro

Todas as respostas de erro têm o mesmo formato, gerado pelo `AllExceptionsFilter` (`src/shared/infra/http/filters/all-exceptions.filter.ts`) e descrito por `ErrorResponseDto`:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `statusCode` | number | status HTTP |
| `code` | string | código estável em `UPPER_SNAKE_CASE`, para o front-end tratar |
| `message` | string | mensagem legível em português, pode ser exibida ao usuário |
| `details` | array, opcional | só em `DADOS_INVALIDOS`: `{ field, messages[] }` por campo |
| `path` | string | rota chamada |
| `timestamp` | string | data e hora ISO 8601 |

Regra de negócio violada (`ConflictError`):

```json
{
  "statusCode": 409,
  "code": "LOTE_INDISPONIVEL",
  "message": "O lote não está disponível para reserva",
  "path": "/v1/reservas",
  "timestamp": "2026-10-28T12:00:00.000Z"
}
```

Validação de entrada:

```json
{
  "statusCode": 400,
  "code": "DADOS_INVALIDOS",
  "message": "Os dados enviados são inválidos",
  "details": [
    { "field": "clienteId", "messages": ["clienteId must be a UUID"] },
    { "field": "endereco.cep", "messages": ["cep inválido"] }
  ],
  "path": "/v1/reservas",
  "timestamp": "2026-10-28T12:00:00.000Z"
}
```

Erro inesperado (detalhes só no log do servidor, nunca na resposta):

```json
{
  "statusCode": 500,
  "code": "ERRO_INTERNO",
  "message": "Erro interno do servidor",
  "path": "/v1/reservas",
  "timestamp": "2026-10-28T12:00:00.000Z"
}
```

### Como lançar erros

Nas camadas `domain` e `application`, lance as classes de `src/shared/domain/errors/domain.error.ts`, sempre com `code` específico e mensagem em português:

```ts
throw new NotFoundError('LOTE_NAO_ENCONTRADO', 'Lote não encontrado');
throw new ConflictError('LOTE_INDISPONIVEL', 'O lote não está disponível para reserva');
throw new BusinessRuleError('RESERVA_NAO_RENOVAVEL', 'Só é possível renovar reservas ativas');
throw new ForbiddenError('RESERVA_DE_OUTRO_VENDEDOR', 'Você só pode alterar as suas reservas');
```

O `code` segue `<ENTIDADE>_<SITUACAO>` e é documentado na seção "Códigos de erro" do `OVERVIEW.md` do módulo. Uma vez publicado, não muda (o front-end depende dele).

Códigos genéricos gerados automaticamente pelo filtro:

| code | HTTP | Origem |
| --- | --- | --- |
| `DADOS_INVALIDOS` | 400 | `ValidationPipe` (DTO inválido) |
| `REQUISICAO_INVALIDA` | 400 | outros `BadRequestException` (ex.: `ParseUUIDPipe`) |
| `NAO_AUTENTICADO` | 401 | token ausente, inválido ou expirado |
| `ACESSO_NEGADO` | 403 | perfil sem permissão (`PerfisGuard`) |
| `RECURSO_NAO_ENCONTRADO` | 404 | rota inexistente, ou Prisma `P2025` |
| `REGISTRO_DUPLICADO` | 409 | Prisma `P2002` (violação de unique, inclusive concorrência) |
| `ERRO_INTERNO` | 500 | qualquer erro não tratado |

## Códigos HTTP

| Status | Quando usar | Classe |
| --- | --- | --- |
| 200 | leitura, atualização ou ação bem-sucedida | — |
| 201 | recurso criado (`POST` de criação) | — |
| 204 | exclusão bem-sucedida, sem corpo | `@HttpCode(HttpStatus.NO_CONTENT)` |
| 400 | entrada malformada ou inválida (tipo, formato, campo obrigatório) | automático (`ValidationPipe`) |
| 401 | sem autenticação | automático (guard) |
| 403 | autenticado, mas sem permissão para a ação ou para **aquele** recurso | `ForbiddenError` / guard |
| 404 | recurso não existe (ou foi excluído) | `NotFoundError` |
| 409 | conflito com o estado atual: recurso já existe, lote já reservado, concorrência | `ConflictError` |
| 422 | entrada bem formada, mas viola regra de negócio que não é conflito de estado (ex.: data de vencimento no passado, proposta com valor zero) | `BusinessRuleError` |
| 500 | erro inesperado | automático |

Dúvida entre 409 e 422: se a mesma requisição poderia dar certo em outro momento, porque depende do estado atual de um recurso (o lote pode ficar disponível de novo), é **409**. Se nunca vai dar certo com esses dados, é **422**.

## Documentação Swagger obrigatória

O Swagger fica em `/docs` (JSON em `/docs-json`). O CLI plugin do `@nestjs/swagger` está habilitado em `nest-cli.json` (`introspectComments`, `classValidatorShim`): ele lê os tipos dos DTOs, os decorators do `class-validator` e os comentários JSDoc. Todo endpoint precisa ter:

1. `@ApiTags('<modulo>')` no controller.
2. `@ApiBearerAuth()` no controller, salvo rotas `@Public()`.
3. Comentário JSDoc de uma linha acima de cada método, que vira o `summary` da operação (`/** Cria uma reserva para um lote disponível */`).
4. `@ApiErrorResponses(...)` com todos os status de erro possíveis da rota (`400`, `401`, `403`, `404`, `409`, `422`).
5. `@ApiPaginatedResponse(ItemDto)` em listagens.
6. Tipo de retorno explícito no método (`Promise<LoteDto>`), para o plugin inferir a resposta.
7. Em cada propriedade de DTO, comentário JSDoc com descrição (quando o nome não basta) e `@example`.
8. Para enums em DTOs, `@ApiProperty({ enum: StatusLote, enumName: 'StatusLote' })`, para o enum aparecer nomeado no schema.

Antes de abrir o PR, abra `/docs` e confira se a rota, os parâmetros, o corpo e as respostas estão corretos.
