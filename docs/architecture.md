# Arquitetura

O backend do Urbizzi é um **monolito modular**: uma aplicação NestJS, um processo, um banco Postgres. O código é dividido em **módulos de domínio** independentes, cada um organizado em camadas (`domain`, `application`, `infra`). A organização segue o modelo usado no LucroAI, sem os microsserviços e sem mensageria entre processos: aqui os módulos se comunicam por chamadas diretas aos serviços exportados, dentro do mesmo processo.

Objetivos:

- **Isolamento**: cada módulo é dono das suas regras e das suas tabelas. Dá para entender e testar um módulo sem conhecer os outros.
- **Previsibilidade**: todo módulo tem a mesma forma. Quem conhece um conhece todos (inclusive a IA).
- **Testabilidade**: regras de negócio ficam em classes sem dependência do framework ou do banco.

## Estrutura de pastas

```
src/
├── main.ts                     # bootstrap (lê PORT e chama setupApp)
├── app.module.ts               # registra ConfigModule, PrismaModule, HealthModule e os módulos de domínio
├── app.setup.ts                # versionamento, ValidationPipe, filtro de erros e Swagger
├── config/
│   └── env.validation.ts       # schema Zod das variáveis de ambiente
├── generated/prisma/           # Prisma Client gerado (não editar, não versionado)
├── modules/                    # módulos de domínio (ver mapa abaixo)
│   └── <modulo>/
└── shared/                     # código transversal, sem regra de negócio de nenhum módulo
    ├── domain/
    │   ├── errors/domain.error.ts
    │   └── pagination.ts
    ├── application/
    │   └── dto/                # PaginationQueryDto, PaginatedDto
    └── infra/
        ├── database/           # PrismaModule, PrismaService, TransactionManager, PrismaTransaction
        ├── health/             # GET /health
        └── http/               # filtro de erros, factory de validação, decorators de Swagger
test/                           # testes e2e (test/<modulo>/*.e2e-spec.ts) e factories
prisma/                         # schema.prisma e migrations
docs/                           # esta documentação
```

`src/shared/` não pode importar nada de `src/modules/`. Se algo é usado por dois módulos e tem regra de negócio, ele pertence a um módulo (o dono da regra), que o exporta.

## Mapa de módulos

Cada entidade do banco pertence a **exatamente um** módulo. Só esse módulo lê e escreve na tabela.

| Módulo (`src/modules/`) | Entidades | Responsabilidade | Depende de | Issues |
| --- | --- | --- | --- | --- |
| `auth` | `TokenRecuperacaoSenha`, `Sessao` | login, emissão de JWT, recuperação de senha | `usuarios` | BE-07, BE-08 |
| `usuarios` | `Usuario`, `Perfil` | gestão de usuários e perfis | `auditoria` | BE-10 |
| `configuracoes` | `Configuracao` | prazos de reserva e de análise | `auditoria` | BE-11 |
| `auditoria` | `HistoricoAuditoria` | registro e consulta do histórico de alterações | — | BE-06, BE-13 |
| `loteamentos` | `Loteamento`, `Quadra`, `Lote` | cadastros, importação de lotes, bloqueio, detalhe do lote | `auditoria` | BE-14 a BE-17, BE-26, BE-27 |
| `clientes` | `Cliente` | cadastro e busca de clientes, histórico do cliente | `auditoria` | BE-18, BE-28 |
| `reservas` | `Reserva`, `ReservaRenovacao` | criar, renovar, cancelar e expirar reservas | `loteamentos`, `clientes`, `configuracoes`, `auditoria` | BE-19 a BE-22 |
| `propostas` | `Proposta` | proposta, aprovação/rejeição, venda do lote | `reservas`, `loteamentos`, `configuracoes`, `auditoria` | BE-23 a BE-25 |
| `plantas` | `Planta` | upload, processamento em tiles, versões da planta | `loteamentos`, `auditoria` | BE-30 a BE-32, BE-34 |
| `mapa` | `Marcador` | marcadores, mapa interno, atualização em tempo real (SSE) | `plantas`, `loteamentos` | BE-33, BE-35, BE-36 |
| `links-publicos` | `LinkPublico` | links públicos e mapa público por token | `mapa`, `auditoria` | BE-37, BE-38 |
| `painel` | — (só leitura) | indicadores | `loteamentos`, `reservas`, `propostas` | BE-39 |

Autenticação e autorização implementadas em `shared/infra/auth` (BE-07/BE-09): `JwtAuthGuard` e `PerfisGuard` globais, `@Public()`, `@CurrentUser()` e `@Perfis(...)`. A policy reutilizável `shared/domain/policies/propriedade.policy.ts` verifica Admin/Gestor ou Comercial responsável, sem depender do framework. Detalhes na [segurança](security.md).

Recursos de `shared` previstos: armazenamento S3 (`shared/infra/storage`, BE-29).

**As dependências entre módulos não podem formar ciclo.** Se A depende de B, B não pode depender de A. Quando uma reação precisar ir no sentido contrário, use eventos (ver [Comunicação entre módulos](#comunicação-entre-módulos)). Ao criar um módulo ou uma dependência nova, atualize esta tabela.

## Cálculo de dias úteis

`shared/domain/dias-uteis.ts` (BE-12) fornece `adicionarDiasUteis` e `diasUteisEntre`, com calendário de São Paulo, feriados fixos/móveis e feriados locais adicionais. Services podem importar essas funções puras diretamente. Contrato, convenções de intervalo e exemplos em [dias-uteis.md](dias-uteis.md).

## Estrutura de um módulo

```
src/modules/<modulo>/
├── <modulo>.module.ts                       # declaração do módulo Nest
├── OVERVIEW.md                              # regras de negócio, endpoints, dependências
├── domain/
│   ├── models/<entidade>.entity.ts          # entidade com as regras de negócio
│   ├── repositories/<entidade>.repository.interface.ts   # contrato + token de injeção
│   ├── policies/<regra>.policy.ts           # (opcional) regras de autorização por propriedade
│   └── events/<evento>.event.ts             # (opcional) eventos de domínio
├── application/
│   ├── dto/                                 # entrada (create/update/list-query) e saída (<entidade>.dto.ts)
│   └── services/<entidade>.service.ts       # casos de uso
└── infra/
    ├── controllers/<recurso>.controller.ts  # rotas HTTP
    └── repositories/prisma-<entidade>.repository.ts       # implementação do contrato com Prisma
```

Um módulo com várias entidades (ex.: `loteamentos` com `Loteamento`, `Quadra` e `Lote`) tem um arquivo de cada tipo por entidade, todos nas mesmas pastas. Não crie submódulos.

### Responsabilidades de cada camada

| Camada | Contém | Pode importar | Não pode |
| --- | --- | --- | --- |
| `domain/` | entidades, contratos de repositório, policies, eventos | apenas `src/shared/domain/` e `node:*` | importar NestJS, Prisma Client, DTOs ou qualquer coisa de `application/` e `infra/` (exceção: tipo `PrismaTransaction` nos contratos de repositório) |
| `application/` | services (casos de uso) e DTOs | `domain/` do próprio módulo, `src/shared/domain/`, `src/shared/application/`, `@nestjs/common` (só `Injectable`/`Inject`), `class-validator`, `class-transformer`, `@nestjs/swagger` (só em DTOs), services exportados por outros módulos, `TransactionManager` | acessar `PrismaService`, lançar `HttpException`, ler `Request`/`Response` |
| `infra/` | controllers e repositórios Prisma | tudo do próprio módulo e `src/shared/` | conter regra de negócio |

Regras de negócio ficam **na entidade** quando dependem só dos dados dela (ex.: "uma reserva só pode ser renovada se estiver ATIVA") e **no service** quando dependem de outros dados (ex.: "o nome do loteamento é único", "o lote precisa estar DISPONIVEL para ser reservado").

### Entidades

- Classe com construtor privado e estado em `private props`.
- `static create(input)` cria uma nova instância: gera o `id` com `randomUUID()` de `node:crypto`, preenche `createdAt`/`updatedAt` e aplica as invariantes.
- `static restore(props)` reconstrói uma instância a partir do banco, sem validar.
- Getters para leitura; nunca setters públicos. Mudanças de estado acontecem em métodos com nome de negócio (`renovar()`, `cancelar()`, `atualizar()`), que validam a regra e lançam `BusinessRuleError`/`ConflictError` quando necessário.
- Sem decorators, sem NestJS, sem Prisma.

### Repositórios

- O contrato (`domain/repositories`) exporta um token `Symbol` e uma interface. O service recebe a interface com `@Inject(TOKEN)`.
- A implementação (`infra/repositories/prisma-*.repository.ts`) é a **única** classe que usa `PrismaService` para as tabelas do módulo. Ela converte registro do Prisma em entidade (`toEntity`) e entidade em `data` do Prisma.
- Métodos que podem rodar dentro de uma transação recebem `tx?: PrismaTransaction` como último parâmetro e usam `const db = tx ?? this.prisma`.
- Retornam entidades (ou `Page<Entidade>` em listagens), nunca registros do Prisma nem DTOs.
- Nomes padrão: `findById`, `list`, `create`, `update`, `delete`, `existsBy<Campo>`, `findBy<Campo>`.

### Services

- Um service por entidade principal (`LoteamentoService`, `QuadraService`).
- Métodos CRUD com nomes em inglês (`create`, `findById`, `list`, `update`, `delete`); ações de negócio em português (`renovar`, `cancelar`, `aprovar`, `bloquear`).
- Recebem DTOs de entrada já validados e devolvem DTOs de saída (`LoteamentoDto.from(entidade)`).
- Lançam apenas erros de `src/shared/domain/errors/domain.error.ts`.
- Abrem transações com `TransactionManager.run()` quando a operação grava em mais de uma tabela ou em mais de um módulo.

### Controllers

- Finos: um método por rota, uma chamada ao service, sem `if` de regra de negócio.
- Validam parâmetros de rota com pipes (`ParseUUIDPipe`) e corpo/query com DTOs.
- Documentados no Swagger (ver [api-standards.md](api-standards.md#documentação-swagger-obrigatória)).
- O nome do arquivo e da classe usa o recurso no plural (`loteamentos.controller.ts`, `LoteamentosController`).

### DTOs

- Entrada: `create-<entidade>.dto.ts`, `update-<entidade>.dto.ts` (estende `PartialType` de `@nestjs/swagger`), `list-<entidades>-query.dto.ts` (estende `PaginationQueryDto`).
- Saída: `<entidade>.dto.ts` com `static from(entidade)`. Nunca devolva a entidade nem o registro do Prisma no controller.
- Cada propriedade tem decorators do `class-validator` (entrada) e comentário JSDoc com `@example` (o CLI plugin do Swagger transforma o comentário em documentação).

## Fluxo de uma requisição

```
HTTP request
  │
  ▼
[JwtAuthGuard / PerfisGuard]       → 401/403 (a partir da BE-07/BE-09)
  │
  ▼
[ValidationPipe global]            → 400 DADOS_INVALIDOS se o DTO for inválido
  │                                   (whitelist + forbidNonWhitelisted + transform)
  ▼
Controller (infra)                 → extrai params/body/query e chama o service
  │
  ▼
Service (application)              → orquestra o caso de uso, abre transação se preciso,
  │                                   chama services de outros módulos
  ▼
Entidade (domain)                  → aplica regras e muda o estado (ou lança DomainError)
  │
  ▼
Repositório (infra, via interface) → persiste com Prisma
  │
  ▼
Service devolve DTO de saída → Controller → resposta JSON

Qualquer exceção em qualquer ponto → AllExceptionsFilter → resposta no formato padrão de erro
```

## Comunicação entre módulos

1. **Chamada direta a um service exportado (padrão).** O módulo A adiciona `BModule` em `imports` e injeta `BService`. Só os services listados em `exports` do `BModule` podem ser usados. Métodos chamados por outros módulos devolvem DTOs, nunca entidades.
2. **Transação envolvendo mais de um módulo.** O service que orquestra abre a transação e passa o `tx` para os métodos dos outros módulos, que o repassam aos repositórios:

   ```ts
   // src/modules/reservas/application/services/reserva.service.ts (ilustrativo)
   async create(dto: CreateReservaDto, vendedorId: string): Promise<ReservaDto> {
     return this.transactionManager.run(async (tx) => {
       const prazo = await this.configuracaoService.getPrazoReservaDias(tx);
       await this.loteService.marcarComoReservado(dto.loteId, tx); // ConflictError se indisponível
       const reserva = Reserva.create({ ...dto, vendedorId, prazoDias: prazo });
       await this.reservaRepository.create(reserva, tx);
       await this.auditoriaService.registrar({ /* ... */ }, tx);
       return ReservaDto.from(reserva);
     });
   }
   ```

3. **Eventos de domínio (quando a reação não pode criar ciclo ou não precisa estar na transação).** Ex.: avisar o mapa em tempo real que o status de um lote mudou (BE-36). Use `@nestjs/event-emitter` (será instalado na primeira issue que precisar): a classe do evento fica em `domain/events/<nome>.event.ts` do módulo que emite, o nome segue `<modulo>.<entidade>.<fato-no-passado>` (ex.: `loteamentos.lote.status-alterado`) e o listener fica em `infra/listeners/` do módulo que reage. Emita o evento **depois** do commit da transação.

Proibido: importar `domain/`, `application/` ou `infra/` de outro módulo diretamente, injetar o repositório de outro módulo, ou consultar as tabelas de outro módulo pelo Prisma (inclusive com `include` de relações que pertencem a outro módulo em escrita; `include` para leitura é aceito apenas dentro do mesmo módulo).

## Autenticação (BE-07)

`AuthModule` importa `UsuariosModule`, que exporta `UsuarioService.autenticar` e `findAtivoById` com dados mínimos do usuário, sem senha/hash. O módulo de usuários começa apenas com consultas para autenticação; seu CRUD permanece na BE-10.

`Sessao` pertence ao módulo `auth`. O repositório é o único a acessar `sessoes`, incluindo consumo condicional e criação do refresh substituto na mesma transação.

O guard global e os decorators `@Public()` e `@CurrentUser()` ficam em `shared/infra/auth`. Para evitar dependência de `shared` para módulos, o guard injeta o contrato `Autenticador` por `AUTENTICADOR`, definido em `shared/domain/usuario-autenticado.ts`. `AuthModule` vincula esse token ao `AuthService`. O contrato `PasswordHasher` em `shared/application/auth` é implementado por Argon2 em `shared/infra/auth`; `UsuarioService` depende apenas do contrato.

Portas técnicas de autenticação (`AccessToken`) ficam em `domain/repositories` e seus adapters JWT em `infra/repositories`. São contratos sem dependência de framework; configuração e criptografia JWT ficam no adapter. Falhas de autenticação usam `AuthenticationError`, traduzido para HTTP 401 pelo filtro global.

`@Public()` pode ser usado no controller ou método e não dispensa a validação de DTOs. `/health` permanece público; as rotas de autenticação abertas são login, refresh e logout. Autorização por perfil é aplicada pelo `PerfisGuard` (BE-09), registrado logo após `JwtAuthGuard` no `AuthModule`. Listas do método substituem listas do controller, sem privilégio automático de Administrador. Propriedade permanece na policy chamada pelo service. As dependências `@nestjs/jwt`, `@nestjs/throttler` e `argon2` fornecem assinatura/verificação JWT, limite de tentativas e hash de senha sem criptografia própria.

## Auditoria

O módulo `auditoria` (BE-06) exporta `AuditoriaService.registrar({ usuarioId, entidadeTipo, entidadeId, acao, valorAnterior, valorNovo, motivo }, tx)`. Toda alteração relevante (mudança de status, criação, edição, exclusão) é auditada **dentro da mesma transação** da alteração. Campos sensíveis (ex.: `senhaHash`) são mascarados pelo próprio serviço. A seção será detalhada na BE-06.

## Exemplo completo: módulo `loteamentos`

Exemplo **ilustrativo** de um módulo com uma entidade, usado como referência de **forma** (camadas, nomes, decorators, testes). Os campos dele (`cidade`, `uf`) e a regra de nome único **não** são os do model real: o `Loteamento` do banco tem `nome`, `descricao` e `localizacao` (ver `prisma/schema.prisma`). Ao implementar um módulo, use sempre os campos do schema e as regras do escopo. Todos os caminhos são relativos a `src/modules/loteamentos/`.

### Prisma (`prisma/schema.prisma`)

```prisma
model Loteamento {
  id        String    @id @default(uuid()) @db.Uuid
  nome      String    @db.VarChar(120)
  cidade    String    @db.VarChar(120)
  uf        String    @db.Char(2)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(3)

  @@index([uf])
  @@map("loteamentos")
}
```

### `domain/models/loteamento.entity.ts`

```ts
import { randomUUID } from 'node:crypto';

export interface LoteamentoProps {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLoteamentoInput = Pick<LoteamentoProps, 'nome' | 'cidade' | 'uf'>;
export type UpdateLoteamentoInput = Partial<CreateLoteamentoInput>;

export class Loteamento {
  private constructor(private props: LoteamentoProps) {}

  static create(input: CreateLoteamentoInput): Loteamento {
    const now = new Date();
    return new Loteamento({
      id: randomUUID(),
      ...Loteamento.normalize(input),
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: LoteamentoProps): Loteamento {
    return new Loteamento({ ...props });
  }

  get id() {
    return this.props.id;
  }

  get nome() {
    return this.props.nome;
  }

  get cidade() {
    return this.props.cidade;
  }

  get uf() {
    return this.props.uf;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  atualizar(input: UpdateLoteamentoInput): void {
    this.props = {
      ...this.props,
      ...Loteamento.normalize(input),
      updatedAt: new Date(),
    };
  }

  private static normalize<T extends UpdateLoteamentoInput>(input: T): T {
    return {
      ...input,
      ...(input.nome !== undefined && { nome: input.nome.trim() }),
      ...(input.cidade !== undefined && { cidade: input.cidade.trim() }),
      ...(input.uf !== undefined && { uf: input.uf.toUpperCase() }),
    };
  }
}
```

### `domain/repositories/loteamento.repository.interface.ts`

```ts
import type { Page, Pagination } from '../../../../shared/domain/pagination.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import type { Loteamento } from '../models/loteamento.entity.js';

export const LOTEAMENTO_REPOSITORY = Symbol('LOTEAMENTO_REPOSITORY');

export interface LoteamentoFiltros {
  q?: string;
  uf?: string;
}

export interface LoteamentoRepository {
  findById(id: string, tx?: PrismaTransaction): Promise<Loteamento | null>;
  existsByNome(nome: string, ignoreId?: string): Promise<boolean>;
  list(filtros: LoteamentoFiltros, pagination: Pagination): Promise<Page<Loteamento>>;
  create(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void>;
  update(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void>;
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
```

### `application/dto/create-loteamento.dto.ts`

```ts
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLoteamentoDto {
  /**
   * Nome comercial do loteamento
   * @example 'Residencial Bela Vista'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome: string;

  /** @example 'Toledo' */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  cidade: string;

  /**
   * Sigla da UF
   * @example 'PR'
   */
  @Matches(/^[A-Za-z]{2}$/, { message: 'uf deve ter 2 letras' })
  uf: string;
}
```

### `application/dto/update-loteamento.dto.ts`

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateLoteamentoDto } from './create-loteamento.dto.js';

export class UpdateLoteamentoDto extends PartialType(CreateLoteamentoDto) {}
```

### `application/dto/list-loteamentos-query.dto.ts`

```ts
import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';

export class ListLoteamentosQueryDto extends PaginationQueryDto {
  /**
   * Busca por parte do nome (sem diferenciar maiúsculas)
   * @example 'bela'
   */
  @IsOptional()
  @IsString()
  q?: string;

  /** @example 'PR' */
  @IsOptional()
  @Matches(/^[A-Za-z]{2}$/)
  uf?: string;
}
```

### `application/dto/loteamento.dto.ts`

```ts
import type { Loteamento } from '../../domain/models/loteamento.entity.js';

export class LoteamentoDto {
  /** @example '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  id: string;
  /** @example 'Residencial Bela Vista' */
  nome: string;
  /** @example 'Toledo' */
  cidade: string;
  /** @example 'PR' */
  uf: string;
  createdAt: Date;
  updatedAt: Date;

  static from(loteamento: Loteamento): LoteamentoDto {
    const dto = new LoteamentoDto();
    dto.id = loteamento.id;
    dto.nome = loteamento.nome;
    dto.cidade = loteamento.cidade;
    dto.uf = loteamento.uf;
    dto.createdAt = loteamento.createdAt;
    dto.updatedAt = loteamento.updatedAt;
    return dto;
  }
}
```

### `application/services/loteamento.service.ts`

```ts
import { Inject, Injectable } from '@nestjs/common';
import { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import {
  LOTEAMENTO_REPOSITORY,
  type LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';
import type { CreateLoteamentoDto } from '../dto/create-loteamento.dto.js';
import type { ListLoteamentosQueryDto } from '../dto/list-loteamentos-query.dto.js';
import { LoteamentoDto } from '../dto/loteamento.dto.js';
import type { UpdateLoteamentoDto } from '../dto/update-loteamento.dto.js';

@Injectable()
export class LoteamentoService {
  constructor(
    @Inject(LOTEAMENTO_REPOSITORY)
    private readonly loteamentoRepository: LoteamentoRepository,
  ) {}

  async create(dto: CreateLoteamentoDto): Promise<LoteamentoDto> {
    await this.ensureNomeDisponivel(dto.nome);
    const loteamento = Loteamento.create(dto);
    await this.loteamentoRepository.create(loteamento);
    return LoteamentoDto.from(loteamento);
  }

  async findById(id: string): Promise<LoteamentoDto> {
    return LoteamentoDto.from(await this.getOrFail(id));
  }

  async list(query: ListLoteamentosQueryDto): Promise<PaginatedDto<LoteamentoDto>> {
    const { page, pageSize, ...filtros } = query;
    const result = await this.loteamentoRepository.list(filtros, { page, pageSize });
    return PaginatedDto.of(
      { items: result.items.map(LoteamentoDto.from), total: result.total },
      { page, pageSize },
    );
  }

  async update(id: string, dto: UpdateLoteamentoDto): Promise<LoteamentoDto> {
    const loteamento = await this.getOrFail(id);
    if (dto.nome !== undefined) await this.ensureNomeDisponivel(dto.nome, id);
    loteamento.atualizar(dto);
    await this.loteamentoRepository.update(loteamento);
    return LoteamentoDto.from(loteamento);
  }

  async delete(id: string): Promise<void> {
    await this.getOrFail(id);
    await this.loteamentoRepository.delete(id);
  }

  private async getOrFail(id: string): Promise<Loteamento> {
    const loteamento = await this.loteamentoRepository.findById(id);
    if (!loteamento) {
      throw new NotFoundError('LOTEAMENTO_NAO_ENCONTRADO', 'Loteamento não encontrado');
    }
    return loteamento;
  }

  private async ensureNomeDisponivel(nome: string, ignoreId?: string): Promise<void> {
    if (await this.loteamentoRepository.existsByNome(nome.trim(), ignoreId)) {
      throw new ConflictError('LOTEAMENTO_JA_EXISTE', 'Já existe um loteamento com esse nome');
    }
  }
}
```

### `infra/repositories/prisma-loteamento.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import type {
  Loteamento as LoteamentoRecord,
  Prisma,
} from '../../../../generated/prisma/client.js';
import { toSkipTake, type Page, type Pagination } from '../../../../shared/domain/pagination.js';
import { PrismaService } from '../../../../shared/infra/database/prisma.service.js';
import type { PrismaTransaction } from '../../../../shared/infra/database/prisma.transaction.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import type {
  LoteamentoFiltros,
  LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';

@Injectable()
export class PrismaLoteamentoRepository implements LoteamentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tx?: PrismaTransaction): Promise<Loteamento | null> {
    const db = tx ?? this.prisma;
    const row = await db.loteamento.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toEntity(row) : null;
  }

  async existsByNome(nome: string, ignoreId?: string): Promise<boolean> {
    const count = await this.prisma.loteamento.count({
      where: {
        nome: { equals: nome, mode: 'insensitive' },
        deletedAt: null,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
    });
    return count > 0;
  }

  async list(filtros: LoteamentoFiltros, pagination: Pagination): Promise<Page<Loteamento>> {
    const where: Prisma.LoteamentoWhereInput = {
      deletedAt: null,
      ...(filtros.uf && { uf: filtros.uf.toUpperCase() }),
      ...(filtros.q && { nome: { contains: filtros.q, mode: 'insensitive' } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loteamento.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(pagination),
      }),
      this.prisma.loteamento.count({ where }),
    ]);
    return { items: rows.map((row) => this.toEntity(row)), total };
  }

  async create(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.create({
      data: {
        id: loteamento.id,
        nome: loteamento.nome,
        cidade: loteamento.cidade,
        uf: loteamento.uf,
        createdAt: loteamento.createdAt,
        updatedAt: loteamento.updatedAt,
      },
    });
  }

  async update(loteamento: Loteamento, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.update({
      where: { id: loteamento.id },
      data: { nome: loteamento.nome, cidade: loteamento.cidade, uf: loteamento.uf },
    });
  }

  async delete(id: string, tx?: PrismaTransaction): Promise<void> {
    const db = tx ?? this.prisma;
    await db.loteamento.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private toEntity(row: LoteamentoRecord): Loteamento {
    return Loteamento.restore({
      id: row.id,
      nome: row.nome,
      cidade: row.cidade,
      uf: row.uf,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
```

### `infra/controllers/loteamentos.controller.ts`

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PaginatedDto } from '../../../../shared/application/dto/paginated.dto.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../../shared/infra/http/swagger/api-paginated-response.decorator.js';
import { CreateLoteamentoDto } from '../../application/dto/create-loteamento.dto.js';
import { ListLoteamentosQueryDto } from '../../application/dto/list-loteamentos-query.dto.js';
import { LoteamentoDto } from '../../application/dto/loteamento.dto.js';
import { UpdateLoteamentoDto } from '../../application/dto/update-loteamento.dto.js';
import { LoteamentoService } from '../../application/services/loteamento.service.js';

@ApiTags('loteamentos')
@ApiBearerAuth()
@Controller('loteamentos')
export class LoteamentosController {
  constructor(private readonly loteamentoService: LoteamentoService) {}

  /** Cria um loteamento */
  @Post()
  // @Perfis(Perfil.ADMINISTRADOR, Perfil.GESTOR)  ← a partir da BE-09
  @ApiErrorResponses(400, 401, 403, 409)
  create(@Body() dto: CreateLoteamentoDto): Promise<LoteamentoDto> {
    return this.loteamentoService.create(dto);
  }

  /** Lista loteamentos com paginação e filtros */
  @Get()
  @ApiPaginatedResponse(LoteamentoDto)
  @ApiErrorResponses(400, 401)
  list(@Query() query: ListLoteamentosQueryDto): Promise<PaginatedDto<LoteamentoDto>> {
    return this.loteamentoService.list(query);
  }

  /** Detalha um loteamento */
  @Get(':id')
  @ApiErrorResponses(400, 401, 404)
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<LoteamentoDto> {
    return this.loteamentoService.findById(id);
  }

  /** Atualiza parcialmente um loteamento */
  @Patch(':id')
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoteamentoDto,
  ): Promise<LoteamentoDto> {
    return this.loteamentoService.update(id, dto);
  }

  /** Exclui (soft delete) um loteamento */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrorResponses(400, 401, 403, 404)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.loteamentoService.delete(id);
  }
}
```

### `loteamentos.module.ts`

```ts
import { Module } from '@nestjs/common';
import { LoteamentoService } from './application/services/loteamento.service.js';
import { LOTEAMENTO_REPOSITORY } from './domain/repositories/loteamento.repository.interface.js';
import { LoteamentosController } from './infra/controllers/loteamentos.controller.js';
import { PrismaLoteamentoRepository } from './infra/repositories/prisma-loteamento.repository.js';

@Module({
  // imports: [AuditoriaModule],  ← módulos dos quais este depende
  controllers: [LoteamentosController],
  providers: [
    LoteamentoService,
    { provide: LOTEAMENTO_REPOSITORY, useClass: PrismaLoteamentoRepository },
  ],
  exports: [LoteamentoService],
})
export class LoteamentosModule {}
```

O `PrismaModule` é global: não precisa ser importado. Registre `LoteamentosModule` em `src/app.module.ts`.

### `OVERVIEW.md`

Todo módulo tem um `OVERVIEW.md` com estas seções:

```md
# Módulo loteamentos

Resumo de uma ou duas frases do que o módulo faz.

## Modelo de domínio
Entidades, campos principais, enums e relacionamentos.

## Regras de negócio
Lista numerada, citando os requisitos (RF/RN) do escopo quando houver.

## Endpoints
| Método | Rota | Perfis | Descrição |

## Códigos de erro
| code | HTTP | Quando |

## Dependências
Módulos importados e services usados; services exportados e quem os usa; eventos emitidos/consumidos.
```

Os testes deste exemplo estão em [testing.md](testing.md#exemplos).
