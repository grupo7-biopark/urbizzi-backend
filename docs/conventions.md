# Convenções

## Idioma

| O quê | Idioma | Exemplo |
| --- | --- | --- |
| Termos de domínio (entidades, campos, enums, ações de negócio) | português, **sem acento e sem cedilha** | `Loteamento`, `dataVencimento`, `StatusReserva.EXPIRADA`, `renovar()` |
| Termos técnicos (sufixos, verbos CRUD, infraestrutura) | inglês | `LoteService`, `findById`, `create`, `Repository`, `Dto` |
| Timestamps padrão | inglês | `createdAt`, `updatedAt`, `deletedAt` |
| Mensagens de erro, comentários, JSDoc, documentação, commits, PRs | português, com acentuação correta | `'Lote não encontrado'` |
| Códigos de erro (`code`) | português, `UPPER_SNAKE_CASE`, sem acento | `LOTE_NAO_ENCONTRADO` |

Quando o termo de domínio é composto, junte as palavras sem preposição desnecessária: `ReservaRenovacao`, `prazoReservaDias`, `TokenRecuperacaoSenha`.

## Arquivos e pastas

- Nomes de arquivo e pasta em `kebab-case`, sempre com sufixo do tipo.
- Um export principal por arquivo; o nome do arquivo corresponde ao da classe.

| Tipo | Arquivo | Classe / símbolo |
| --- | --- | --- |
| Módulo | `loteamentos.module.ts` | `LoteamentosModule` |
| Entidade | `domain/models/lote.entity.ts` | `Lote` |
| Contrato de repositório | `domain/repositories/lote.repository.interface.ts` | `LoteRepository` + `LOTE_REPOSITORY` |
| Policy | `domain/policies/reserva-propriedade.policy.ts` | `ReservaPropriedadePolicy` |
| Evento | `domain/events/lote-status-alterado.event.ts` | `LoteStatusAlteradoEvent` |
| Service | `application/services/lote.service.ts` | `LoteService` |
| DTO de criação | `application/dto/create-lote.dto.ts` | `CreateLoteDto` |
| DTO de atualização | `application/dto/update-lote.dto.ts` | `UpdateLoteDto` |
| DTO de listagem | `application/dto/list-lotes-query.dto.ts` | `ListLotesQueryDto` |
| DTO de ação | `application/dto/cancelar-reserva.dto.ts` | `CancelarReservaDto` |
| DTO de saída | `application/dto/lote.dto.ts` | `LoteDto` |
| Controller | `infra/controllers/lotes.controller.ts` | `LotesController` |
| Repositório Prisma | `infra/repositories/prisma-lote.repository.ts` | `PrismaLoteRepository` |
| Listener de evento | `infra/listeners/lote-status-alterado.listener.ts` | `LoteStatusAlteradoListener` |
| Teste unitário | ao lado do arquivo: `lote.entity.spec.ts` | — |
| Teste e2e | `test/<modulo>/lotes.e2e-spec.ts` | — |
| Factory de teste | `test/factories/lote.factory.ts` | `makeLote()` |

O nome da pasta do módulo é o plural do agregado principal em kebab-case (`loteamentos`, `links-publicos`).

## Código TypeScript

- Classes, interfaces, tipos e enums: `PascalCase`. Sem prefixo `I` em interfaces.
- Variáveis, funções, métodos e propriedades: `camelCase`.
- Constantes de módulo e tokens de injeção: `UPPER_SNAKE_CASE` (`LOTE_REPOSITORY`).
- Valores de enum: `UPPER_SNAKE_CASE` (`DISPONIVEL`, `EM_ANALISE`). Use os enums gerados pelo Prisma (`import { StatusLote } from '<...>/generated/prisma/client.js'`) em DTOs e repositórios; na camada `domain`, use `type StatusLote = 'DISPONIVEL' | ...` ou o enum importado só como tipo.
- Booleanos com prefixo de predicado: `ativo`, `isPublic`, `podeRenovar()`.
- Imports relativos com extensão `.js`; sem path alias; sem `index.ts` de reexportação. Ordem: `node:*`, pacotes externos, código do projeto.
- `import type` para importações usadas só como tipo.
- Sem `any`. Use `unknown` e refine o tipo.
- Sem comentários óbvios. Comente o **porquê** de decisões não evidentes.
- Datas sempre em UTC (`Date`); conversão de fuso só no front-end.
- Valores monetários: `Prisma.Decimal` no banco e no código; nunca `number` para dinheiro.

Formatação é responsabilidade do Prettier (`.prettierrc`: aspas simples, vírgula final). Não discuta estilo em PR: rode `npm run format`.

## Rotas

- Recurso no plural, `kebab-case`, em português: `/v1/loteamentos`, `/v1/links-publicos`.
- Parâmetros de rota em `camelCase` com sufixo `Id`: `/v1/loteamentos/:loteamentoId/quadras`.
- Ações de negócio que não são CRUD: `POST /v1/<recurso>/:id/<verbo-no-infinitivo>` (`/v1/reservas/:id/renovar`, `/v1/propostas/:id/aprovar`).
- Campos de JSON e query string em `camelCase`.

Detalhes em [api-standards.md](api-standards.md).

## Banco de dados

| O quê | Prisma | Banco |
| --- | --- | --- |
| Model | `PascalCase` singular (`ReservaRenovacao`) | tabela `snake_case` no plural via `@@map("reserva_renovacoes")` |
| Campo | `camelCase` (`dataVencimento`) | coluna `snake_case` via `@map("data_vencimento")` |
| Chave estrangeira | `<entidade>Id` (`loteId`) | `lote_id` |
| Enum | `PascalCase` (`StatusLote`), valores `UPPER_SNAKE_CASE` | `@@map("status_lote")` |
| Índice / unique | nome gerado pelo Prisma, ou `map: "<tabela>_<colunas>_<idx\|key>"` em índices customizados | — |
| Migration | `npm run db:migrate -- --name <verbo>_<descricao>` em `snake_case` | `20261028120000_create_loteamentos` |

Detalhes em [database.md](database.md).

## Commits (Conventional Commits)

Formato: `<tipo>(<escopo>): <descrição>`

- **tipo**: `feat` (funcionalidade), `fix` (correção), `refactor` (sem mudar comportamento), `test`, `docs`, `chore` (build, dependências, configuração), `ci`, `perf`.
- **escopo**: nome do módulo (`reservas`, `loteamentos`) ou área técnica (`prisma`, `docker`, `shared`, `config`). Opcional quando a mudança é geral.
- **descrição**: em português, no imperativo ou presente, com inicial minúscula, sem ponto final, até ~72 caracteres. Ex.: `feat(reservas): adiciona renovação de reserva`.
- Corpo (opcional): o porquê da mudança, quebrado em linhas de ~72 caracteres.
- Mudança incompatível na API: `feat(reservas)!: ...` e um parágrafo `BREAKING CHANGE: ...` no corpo.
- Commits pequenos e coesos; cada commit deve compilar.

## Branches

- `main` é protegida; todo código entra por Pull Request.
- Nome: `<tipo>/be-<nn>-<descricao-curta>` em `kebab-case`, onde `<nn>` é o número da issue no padrão `BE-NN`. Ex.: `feat/be-19-criar-reserva`, `fix/be-21-expiracao-fuso`, `docs/be-02-arquitetura`.
- Sem issue (raro): `<tipo>/<descricao-curta>`.
- Uma branch por issue. Atualize com `git rebase origin/main` (ou merge) antes de pedir revisão.

## Pull Requests

- Título: `[BE-NN] <título da issue>`.
- Corpo: o template de `.github/PULL_REQUEST_TEMPLATE.md` preenchido, com `Closes #<número>`.
- Revisão de pelo menos um integrante (dois para mudanças de arquitetura ou de `docs/`).
- Os dois jobs do CI (`Lint, build e testes unitários` e `Testes e2e`) precisam estar verdes antes do merge (ver [testing.md](testing.md#integração-contínua)).
