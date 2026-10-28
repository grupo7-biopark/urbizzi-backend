# AGENTS.md

Guia para agentes de IA (Claude Code, Codex, Cursor, Copilot etc.) e para os integrantes do time. **Leia este arquivo inteiro antes de alterar o código.** Os detalhes de cada assunto estão em `docs/`; em caso de conflito, `docs/` prevalece sobre o que você "acha" que é o padrão do NestJS.

## Visão geral

Backend do **Urbizzi**: sistema de gestão de loteamentos (cadastro de loteamentos, quadras e lotes, reservas com prazo, propostas com análise do gestor, planta interativa com marcadores e link público do mapa).

É um **monolito modular**: uma única aplicação NestJS e um único banco Postgres, divididos em módulos de domínio isolados em `src/modules/<modulo>/`, cada um com as camadas `application/`, `domain/` e `infra/`. Os módulos só conversam pelos serviços que exportam.

## Stack

| Item | Tecnologia |
| --- | --- |
| Runtime | Node.js 24, ESM (`"type": "module"`) |
| Framework | NestJS 12, TypeScript `strict` |
| Banco | PostgreSQL 17 + Prisma ORM 7 (`@prisma/adapter-pg`) |
| Validação | `class-validator` / `class-transformer` (DTOs), Zod (variáveis de ambiente) |
| Documentação da API | `@nestjs/swagger` com CLI plugin, em `/docs` |
| Testes | Vitest + Supertest |
| Lint / formatação | oxlint + Prettier |
| Arquivos | Garage (S3 compatível), a partir da BE-29 |
| Infra local | Docker Compose (`api` + `postgres`) |

## Comandos

```bash
docker compose up --build      # sobe API (hot reload) + Postgres
npm run start:dev              # API fora do Docker (precisa do Postgres)
npm run lint                   # oxlint
npm run format                 # Prettier (escreve)
npm run format:check           # Prettier (só verifica)
npm run build                  # compila para dist/
npm test                       # testes unitários
npm run test:e2e               # testes e2e (precisa do Postgres)
npm run test:cov               # unitários com cobertura
npx vitest run caminho/arquivo.spec.ts   # um arquivo só
npm run db:migrate -- --name <nome>      # cria e aplica migration
npm run db:generate            # regenera o Prisma Client
```

Antes de dizer que terminou: `npm run lint && npm run format:check && npm run build && npm run test:cov` precisam passar (é o que o CI roda; `test:cov` falha com cobertura abaixo de 80% em `domain/` e `application/`). Se mexeu em controller, rota ou banco, rode também `npm run test:e2e`, que o CI também executa contra um Postgres limpo.

## Mapa de documentação

| Arquivo | Leia quando for... |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | criar ou alterar um módulo, entender as camadas, a comunicação entre módulos e o **exemplo completo de módulo** |
| [docs/conventions.md](docs/conventions.md) | nomear arquivos, classes, rotas, tabelas e colunas; escrever commits e branches |
| [docs/api-standards.md](docs/api-standards.md) | criar endpoints: REST, versionamento, paginação, filtros, formato de erro, status HTTP, Swagger |
| [docs/database.md](docs/database.md) | alterar o `schema.prisma`, criar migrations, usar transações |
| [docs/testing.md](docs/testing.md) | escrever testes unitários e e2e |
| [docs/security.md](docs/security.md) | autenticação, autorização por perfil, dados pessoais (LGPD) e segredos |
| [docs/Urbizzi - Escopo do Sistema v2.md](<docs/Urbizzi - Escopo do Sistema v2.md>) | entender o negócio: perfis e permissões, fluxos, regras (RN), requisitos (RF/RNF) e modelo de dados. É a fonte dos códigos RN/RF citados nas issues |

Cada módulo tem um `OVERVIEW.md` próprio descrevendo suas regras de negócio, endpoints e dependências. Leia o do módulo antes de alterá-lo.

## Regras obrigatórias

1. **Siga a estrutura de módulo** de [docs/architecture.md](docs/architecture.md#estrutura-de-um-módulo). Não crie pastas ou camadas novas sem atualizar a documentação no mesmo PR.
2. **Controllers são finos**: recebem DTO, chamam um método do service e devolvem DTO. Regra de negócio fica na entidade (`domain/models`) ou no service (`application/services`).
3. **Só o repositório acessa o Prisma.** Services dependem da interface do repositório (`domain/repositories`), injetada por token `Symbol`.
4. **Um módulo nunca importa arquivos internos de outro módulo.** Só pode importar o `<modulo>.module.ts` dele e usar os services listados em `exports`. Nunca acesse tabelas de outro módulo pelo Prisma.
5. **Erros de negócio usam as classes de `src/shared/domain/errors/domain.error.ts`** (`NotFoundError`, `ConflictError`, `BusinessRuleError`, `ForbiddenError`), com um `code` em `UPPER_SNAKE_CASE`. Não lance `HttpException` em `domain/` nem em `application/`.
6. **Toda rota é documentada no Swagger** (ver [docs/api-standards.md](docs/api-standards.md#documentação-swagger-obrigatória)).
7. **Listagens são sempre paginadas** com `PaginationQueryDto` e respondem `PaginatedDto`.
8. **Imports relativos com extensão `.js`** (ESM `nodenext`), sem path alias e sem arquivos `index.ts` de reexportação.
9. **Nunca edite `src/generated/`** (Prisma Client gerado) nem migrations já mergeadas.
10. **Toda mudança de comportamento vem com teste** (ver [docs/testing.md](docs/testing.md)).
11. **Nunca registre dados pessoais nem segredos** em logs, respostas de erro ou auditoria (ver [docs/security.md](docs/security.md)).
12. **Idioma**: termos de domínio em português sem acento (`Loteamento`, `dataVencimento`); termos técnicos em inglês (`Service`, `findById`); textos para pessoas (mensagens, docs, commits) em português.
13. Não adicione dependências novas sem necessidade clara; se adicionar, justifique no PR.

## Como criar um módulo novo (checklist)

1. Leia a issue, o [mapa de módulos](docs/architecture.md#mapa-de-módulos) e o `OVERVIEW.md` dos módulos dos quais você vai depender.
2. Se precisar de tabela nova, altere `prisma/schema.prisma` seguindo [docs/database.md](docs/database.md) e rode `npm run db:migrate -- --name <nome>`.
3. Crie `src/modules/<modulo>/` copiando a estrutura do [exemplo completo](docs/architecture.md#exemplo-completo-módulo-loteamentos):
   - `domain/models/<entidade>.entity.ts`
   - `domain/repositories/<entidade>.repository.interface.ts`
   - `application/dto/*.dto.ts`
   - `application/services/<entidade>.service.ts`
   - `infra/repositories/prisma-<entidade>.repository.ts`
   - `infra/controllers/<recurso-no-plural>.controller.ts`
   - `<modulo>.module.ts` e `OVERVIEW.md`
4. Registre o módulo em `src/app.module.ts`.
5. Escreva os testes: unitários da entidade e do service (`*.spec.ts` ao lado do arquivo) e e2e das rotas (`test/<modulo>/*.e2e-spec.ts`).
6. Confira o Swagger em <http://localhost:3000/docs>.
7. Rode a verificação completa (seção [Comandos](#comandos)) e abra o PR usando o template.

## O que já existe em `src/shared/`

| Caminho | O que é |
| --- | --- |
| `domain/errors/domain.error.ts` | `DomainError` e subclasses (404, 409, 422, 403) |
| `domain/pagination.ts` | tipos `Pagination`, `Page<T>` e `toSkipTake()` |
| `application/dto/pagination-query.dto.ts` | `PaginationQueryDto` (`page`, `pageSize`) |
| `application/dto/paginated.dto.ts` | `PaginatedDto<T>` (`{ data, meta }`) |
| `infra/database/` | `PrismaModule` (global), `PrismaService`, tipo `PrismaTransaction` |
| `infra/http/filters/all-exceptions.filter.ts` | converte qualquer erro no formato padrão |
| `infra/http/swagger/` | `@ApiErrorResponses()` e `@ApiPaginatedResponse()` |
| `infra/health/` | `GET /health` |

Previsto em issues futuras (não use antes de existir): `infra/auth/` com `@Public()`, `@CurrentUser()`, `@Perfis()` e os guards (BE-07, BE-09); `infra/storage/` (BE-29); utilitário de dias úteis (BE-12); `AuditoriaService` no módulo `auditoria` (BE-06).
