# Testes

Ferramentas: **Vitest** (com `globals: true`, então `describe`/`it`/`expect`/`vi` não precisam de import) e **Supertest** para HTTP.

| Comando | O que roda | Config |
| --- | --- | --- |
| `npm test` | unitários (`src/**/*.spec.ts`) | `vitest.config.ts` |
| `npm run test:e2e` | e2e (`test/**/*.e2e-spec.ts`), precisa do Postgres | `vitest.config.e2e.ts` |
| `npm run test:cov` | unitários com cobertura (v8) | `vitest.config.ts` |
| `npx vitest run <arquivo>` | um arquivo | — |

## O que testar em cada nível

### Unitário (`*.spec.ts`, ao lado do arquivo testado)

Sem banco, sem HTTP, sem `Test.createTestingModule` (instancie as classes direto). Rápido e determinístico.

| Alvo | O que cobrir |
| --- | --- |
| Entidade (`domain/models`) | `create()` com os valores padrão e normalizações; cada método de negócio no caminho feliz e em **cada** regra violada (erro e `code` esperados); transições de status permitidas e proibidas |
| Policy (`domain/policies`) | cada perfil e cada caso de propriedade (dono / não dono) |
| Service (`application/services`) | orquestração: chama o repositório certo, lança `NotFoundError`/`ConflictError` nos casos previstos, devolve o DTO correto; usa repositório **fake** (objeto com `vi.fn()`) e `TransactionManager` fake |
| Utilitários de `shared` | todos os ramos |
| DTOs com validação não trivial (ex.: `@Transform`) | entrada válida e inválida com `plainToInstance` + `validate` |

Não escreva teste unitário para controller (é coberto pelo e2e) nem para repositório Prisma (é coberto pelo e2e/integração).

### E2E (`test/<modulo>/<recurso>.e2e-spec.ts`)

Sobe o `AppModule` inteiro com `setupApp(app)` e faz requisições reais com Supertest contra o Postgres.

Para cada rota, cubra pelo menos:

1. Caminho feliz: status e corpo da resposta.
2. Validação: corpo inválido retorna `400` com `code: 'DADOS_INVALIDOS'`.
3. Recurso inexistente retorna `404` com o `code` do módulo.
4. Cada regra de negócio/conflito exposta pela rota (`409`/`422`) com o `code` esperado.
5. Autorização (a partir da BE-09): perfil permitido recebe 2xx; perfil não permitido recebe `403`.
6. Listagens: paginação (`meta`) e cada filtro.

### Integração

Regras garantidas pelo banco (índices únicos parciais, concorrência, rollback de transação) são testadas no e2e ou em `test/<modulo>/*.e2e-spec.ts` chamando o service/repositório real obtido de `app.get(...)`. Ex.: disparar duas reservas concorrentes com `Promise.all` e verificar que só uma foi criada.

## Banco de teste

- Localmente, os e2e usam o banco do `.env` (o mesmo do `docker compose`).
- No CI, os e2e rodam contra um Postgres 17 próprio (service container, banco `urbizzi_test`), criado vazio a cada execução e com as migrations aplicadas por `npm run db:deploy` antes dos testes (ver [Integração contínua](#integração-contínua)).
- Cada arquivo e2e limpa as tabelas que usa no `beforeEach`, com `TRUNCATE ... RESTART IDENTITY CASCADE`, em vez de depender da ordem dos testes:

```ts
const prisma = app.get(PrismaService);
await prisma.$executeRawUnsafe('TRUNCATE TABLE "loteamentos" RESTART IDENTITY CASCADE');
```

- Nunca rode e2e apontando para banco de produção.

## Factories

Ficam em `test/factories/<entidade>.factory.ts` e criam dados válidos com valores padrão, aceitando sobrescritas:

```ts
// test/factories/loteamento.factory.ts
import { Loteamento, type CreateLoteamentoInput } from '../../src/modules/loteamentos/domain/models/loteamento.entity.js';

export function makeLoteamento(overrides: Partial<CreateLoteamentoInput> = {}): Loteamento {
  return Loteamento.create({
    nome: 'Residencial Teste',
    cidade: 'Toledo',
    uf: 'PR',
    ...overrides,
  });
}
```

Nos e2e, insira dados por meio do repositório ou do service real (`app.get(LoteamentoService).create(...)`) ou do Prisma, para não depender de outras rotas.

## Exemplos

### Entidade

```ts
// src/modules/loteamentos/domain/models/loteamento.entity.spec.ts
import { Loteamento } from './loteamento.entity.js';

describe('Loteamento', () => {
  it('normaliza nome, cidade e UF ao criar', () => {
    const loteamento = Loteamento.create({ nome: ' Bela Vista ', cidade: 'Toledo', uf: 'pr' });

    expect(loteamento.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(loteamento.nome).toBe('Bela Vista');
    expect(loteamento.uf).toBe('PR');
  });

  it('atualiza apenas os campos informados', () => {
    const loteamento = Loteamento.create({ nome: 'A', cidade: 'Toledo', uf: 'PR' });

    loteamento.atualizar({ cidade: 'Cascavel' });

    expect(loteamento.nome).toBe('A');
    expect(loteamento.cidade).toBe('Cascavel');
  });
});
```

### Service com repositório fake

```ts
// src/modules/loteamentos/application/services/loteamento.service.spec.ts
import { ConflictError, NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
import type { LoteamentoRepository } from '../../domain/repositories/loteamento.repository.interface.js';
import { LoteamentoService } from './loteamento.service.js';

describe('LoteamentoService', () => {
  let repository: { [K in keyof LoteamentoRepository]: ReturnType<typeof vi.fn> };
  let service: LoteamentoService;

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      existsByNome: vi.fn().mockResolvedValue(false),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    service = new LoteamentoService(repository as unknown as LoteamentoRepository);
  });

  it('cria e devolve o DTO', async () => {
    const dto = await service.create({ nome: 'Bela Vista', cidade: 'Toledo', uf: 'PR' });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(dto).toMatchObject({ nome: 'Bela Vista', uf: 'PR' });
  });

  it('lança ConflictError quando o nome já existe', async () => {
    repository.existsByNome.mockResolvedValue(true);

    await expect(
      service.create({ nome: 'Bela Vista', cidade: 'Toledo', uf: 'PR' }),
    ).rejects.toThrow(ConflictError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lança NotFoundError quando o loteamento não existe', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById('id-inexistente')).rejects.toMatchObject({
      constructor: NotFoundError,
      code: 'LOTEAMENTO_NAO_ENCONTRADO',
    });
  });
});
```

`TransactionManager` fake, quando o service usar transação:

```ts
const transactionManager = { run: vi.fn((fn) => fn({})) } as unknown as TransactionManager;
```

### E2E

```ts
// test/loteamentos/loteamentos.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';

describe('Loteamentos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "loteamentos" RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/loteamentos cria e retorna 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/loteamentos')
      .send({ nome: 'Bela Vista', cidade: 'Toledo', uf: 'PR' })
      .expect(201);

    expect(res.body).toMatchObject({ id: expect.any(String), nome: 'Bela Vista' });
  });

  it('POST /v1/loteamentos com corpo inválido retorna 400 DADOS_INVALIDOS', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/loteamentos')
      .send({ nome: '', uf: 'Paraná' })
      .expect(400);

    expect(res.body.code).toBe('DADOS_INVALIDOS');
    expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['nome', 'cidade', 'uf']),
    );
  });

  it('GET /v1/loteamentos/:id inexistente retorna 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/loteamentos/0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10')
      .expect(404);

    expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
  });
});
```

## Cobertura mínima

- **80% de linhas e de branches** em `src/modules/**/domain/**` e `src/modules/**/application/**`.
- Todo `code` de erro documentado no `OVERVIEW.md` tem pelo menos um teste que o produz.
- Todo bug corrigido ganha um teste que falhava antes da correção.
- O limite está configurado em `vitest.config.ts` (`coverage.thresholds`): `npm run test:cov` falha abaixo de 80%, localmente e no CI.

## Integração contínua

O workflow `.github/workflows/ci.yml` roda em todo Pull Request e em todo push na `main`, com dois jobs em paralelo:

| Job | Etapas |
| --- | --- |
| **Lint, build e testes unitários** | `npm ci` (com cache do npm) → `lint` → `format:check` → `build` → `test:cov` (com limite de cobertura) |
| **Testes e2e** | Postgres como service container → `npm ci` → `db:generate` → `db:deploy` → `test:e2e` |

Um novo push no mesmo PR cancela a execução anterior.

A `main` é protegida no GitHub: não aceita push direto nem force push, todo código entra por Pull Request e o merge fica bloqueado até os dois jobs acima ficarem verdes (vale também para administradores). Se renomear um job no workflow, atualize as verificações obrigatórias em *Settings → Branches*, senão todo PR fica esperando um check que não existe mais. Para reproduzir localmente o que o CI faz: `npm run lint && npm run format:check && npm run build && npm run test:cov && npm run test:e2e`.

## Boas práticas

- Nome do teste em português, descrevendo o comportamento: `it('lança ConflictError quando o lote já está reservado')`.
- Estrutura Arrange / Act / Assert, separada por linha em branco.
- Um comportamento por `it`.
- Não dependa de horário real: use `vi.useFakeTimers()` e `vi.setSystemTime()` para prazos e vencimentos.
- Não teste detalhes de implementação (ordem de chamadas internas, métodos privados).
