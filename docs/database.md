# Banco de dados

PostgreSQL 17 acessado pelo **Prisma ORM 7** com o driver adapter `@prisma/adapter-pg`.

| Arquivo | Papel |
| --- | --- |
| `prisma/schema.prisma` | schema único com todos os models (um arquivo para o monolito) |
| `prisma/migrations/` | migrations versionadas |
| `prisma7.config.ts` | configuração do Prisma CLI (schema, migrations, `DATABASE_URL`) |
| `src/generated/prisma/` | Prisma Client gerado por `npm run db:generate` (não versionado, não editar) |
| `src/shared/infra/database/` | `PrismaService`, `PrismaModule` (global), `TransactionManager`, `PrismaTransaction` |

O Prisma Client é importado de `src/generated/prisma/client.js`, nunca de `@prisma/client`.

## Organização do schema

- Os models ficam agrupados por módulo, na ordem do [mapa de módulos](architecture.md#mapa-de-módulos), com um comentário de seção: `// ===== reservas =====`.
- Cada model pertence a um único módulo (ver mapa). Relações entre models de módulos diferentes são permitidas no schema (chaves estrangeiras garantem integridade), mas o código de um módulo não escreve nas tabelas de outro.
- O diagrama ER fica neste arquivo, na seção [Diagrama ER](#diagrama-er), em Mermaid, e é atualizado no mesmo PR que alterar o schema.

## Padrões de modelagem

### Chave primária

Toda tabela usa uuid:

```prisma
id String @id @default(uuid()) @db.Uuid
```

O id é gerado pela entidade em `create()` (`randomUUID()` de `node:crypto`) e enviado pelo repositório no `create`. O `@default(uuid())` é só uma garantia para inserts fora da aplicação (seed, SQL manual). Chaves estrangeiras também são `String @db.Uuid`.

### Timestamps

Toda tabela tem:

```prisma
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
```

Exceção: tabelas só de inserção (ex.: `HistoricoAuditoria`, `ReservaRenovacao`) têm só `createdAt`. Datas de negócio (`dataVencimento`, `dataInicio`) também usam `@db.Timestamptz(3)`; datas sem hora (feriados) usam `@db.Date`.

### Nomes

Models e campos em português sem acento (`camelCase` no Prisma), mapeados para `snake_case` no banco com `@map`/`@@map`. Tabelas no plural. Ver [conventions.md](conventions.md#banco-de-dados).

```prisma
model ReservaRenovacao {
  id                 String   @id @default(uuid()) @db.Uuid
  reservaId          String   @map("reserva_id") @db.Uuid
  dataVencimentoNova DateTime @map("data_vencimento_nova") @db.Timestamptz(3)
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  reserva Reserva @relation(fields: [reservaId], references: [id])

  @@index([reservaId])
  @@map("reserva_renovacoes")
}
```

### Tipos

| Dado | Tipo Prisma |
| --- | --- |
| Texto curto (nome, título) | `String @db.VarChar(n)` com limite explícito, igual ao `@MaxLength` do DTO |
| Texto longo (motivo, observação) | `String @db.Text` |
| Dinheiro | `Decimal @db.Decimal(14, 2)`; no DTO de saída, `valor.toFixed(2)` |
| Área, medidas | `Decimal @db.Decimal(12, 2)` |
| Status | `enum` do Prisma |
| Documento (CPF/CNPJ) | `String @db.VarChar(14)`, só dígitos |
| Dados flexíveis (auditoria) | `Json` |

Nunca use `Float` para dinheiro ou medidas.

### Enums

```prisma
enum StatusLote {
  DISPONIVEL
  RESERVADO
  VENDIDO
  BLOQUEADO

  @@map("status_lote")
}
```

### Exclusão: soft delete ou não

| Caso | Estratégia |
| --- | --- |
| Cadastros referenciados por histórico (`Loteamento`, `Quadra`, `Lote`, `Cliente`) | **soft delete**: `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)`. O repositório filtra `deletedAt: null` em todas as leituras e o `delete()` faz `update` preenchendo `deletedAt`. |
| `Usuario` | nunca é excluído: tem `ativo Boolean @default(true)` e é desativado. |
| Registros de processo (`Reserva`, `Proposta`, `ReservaRenovacao`) | nunca são excluídos: mudam de status (`CANCELADA`, `EXPIRADA`, `REJEITADA`). |
| `HistoricoAuditoria` | imutável: sem update e sem delete. |
| Dados técnicos sem histórico (`TokenRecuperacaoSenha`, `Marcador`, `LinkPublico` desativado há tempo) | exclusão física (`delete`). |

Com soft delete, unicidade tem que ignorar os excluídos: crie um índice único parcial (`... WHERE deleted_at IS NULL`) por migration SQL customizada em vez de `@@unique`.

### Índices e restrições

- `@@unique` para toda regra de unicidade do domínio (e-mail do usuário, documento do cliente, `(loteamentoId, numero)` da quadra etc.). A regra é garantida pelo banco, não só pelo código.
- `@@index` para colunas usadas em filtros e ordenação frequentes e para toda chave estrangeira.
- Regras que o Prisma não expressa (índice único parcial, `CHECK`) vão em SQL na migration, com comentário no schema indicando onde estão:

```prisma
model Reserva {
  // ...
  // Índice único parcial "reservas_lote_id_ativa_key" (no máximo uma reserva ATIVA por lote)
  // criado em SQL na migration <timestamp>_create_reservas.
}
```

## Migrations

- Criar e aplicar em desenvolvimento: `npm run db:migrate -- --name <verbo>_<descricao>` (ex.: `create_loteamentos`, `add_status_to_lotes`).
- Migration com SQL customizado: `npx prisma migrate dev --create-only --name <nome>`, edite o `migration.sql` gerado, depois `npm run db:migrate`.
- Aplicar em CI/produção: `npm run db:deploy` (nunca `migrate dev`). O container de desenvolvimento roda `prisma migrate deploy` ao subir.
- **Nunca edite** uma migration que já está na `main`; crie uma nova.
- Uma migration por PR sempre que possível, com o mesmo escopo do PR.
- Mudanças destrutivas (remover coluna, mudar tipo) em duas etapas: primeiro o código para de usar, depois uma migration remove.
- O `migration.sql` faz parte da revisão do PR.

## Transações

Use transação sempre que uma operação gravar em mais de uma tabela, ou ler e depois gravar com base no que leu (verificar status e mudar status).

```ts
// application/services/reserva.service.ts (ilustrativo)
constructor(
  private readonly transactionManager: TransactionManager,
  @Inject(RESERVA_REPOSITORY) private readonly reservaRepository: ReservaRepository,
  private readonly loteService: LoteService,
) {}

return this.transactionManager.run(async (tx) => {
  await this.loteService.marcarComoReservado(dto.loteId, tx);
  await this.reservaRepository.create(reserva, tx);
  return ReservaDto.from(reserva);
});
```

Regras:

1. Quem abre a transação é o **service** que orquestra o caso de uso, com `TransactionManager.run()` (`src/shared/infra/database/transaction.manager.ts`). Repositórios nunca abrem transação interativa (o `$transaction([...])` em lote para `findMany` + `count` de listagens é permitido).
2. O `tx` é repassado como último parâmetro (`tx?: PrismaTransaction`) para repositórios e para services de outros módulos. Dentro do repositório: `const db = tx ?? this.prisma`.
3. Se qualquer passo lançar erro, tudo é desfeito (rollback automático). Lance `DomainError` normalmente dentro da transação.
4. Nada de I/O externo (e-mail, S3, HTTP) dentro da transação: faça antes ou depois do commit.
5. Transações curtas: sem laços longos e sem esperar o usuário.
6. Concorrência: para "ler status e mudar status", use atualização condicional e verifique quantas linhas mudaram, ou um índice único parcial e trate o `P2002` (o filtro converte em `409 REGISTRO_DUPLICADO`; se quiser um `code` específico, capture no repositório e lance `ConflictError`):

```ts
// infra/repositories/prisma-lote.repository.ts (ilustrativo)
async marcarComoReservado(id: string, tx?: PrismaTransaction): Promise<boolean> {
  const db = tx ?? this.prisma;
  const { count } = await db.lote.updateMany({
    where: { id, status: 'DISPONIVEL', deletedAt: null },
    data: { status: 'RESERVADO' },
  });
  return count === 1; // o service lança ConflictError('LOTE_INDISPONIVEL', ...) se false
}
```

## Seeds

Seeds ficam em `prisma/seed/` (BE-05), são idempotentes (`upsert` por chave natural) e rodam com `npm run db:seed` (obrigatório) e `npm run db:seed:dev` (dados de exemplo).

## Diagrama ER

Será preenchido na BE-04, em Mermaid (`erDiagram`), com todas as entidades do escopo v2.
