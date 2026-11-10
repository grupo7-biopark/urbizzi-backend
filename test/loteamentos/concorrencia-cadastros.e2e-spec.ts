import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { LoteamentoService } from '../../src/modules/loteamentos/application/services/loteamento.service.js';
import { LoteService } from '../../src/modules/loteamentos/application/services/lote.service.js';
import { ClienteService } from '../../src/modules/clientes/application/services/cliente.service.js';
import type { PrismaLoteamentoRepository } from '../../src/modules/loteamentos/infra/repositories/prisma-loteamento.repository.js';
import type { PrismaLoteRepository } from '../../src/modules/loteamentos/infra/repositories/prisma-lote.repository.js';
import type { PrismaClienteRepository } from '../../src/modules/clientes/infra/repositories/prisma-cliente.repository.js';
import { LOTEAMENTO_REPOSITORY } from '../../src/modules/loteamentos/domain/repositories/loteamento.repository.interface.js';
import { LOTE_REPOSITORY } from '../../src/modules/loteamentos/domain/repositories/lote.repository.interface.js';
import { CLIENTE_REPOSITORY } from '../../src/modules/clientes/domain/repositories/cliente.repository.interface.js';
import { limparBanco } from '../helpers/database.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';

function sinal() {
  let resolver!: () => void;
  const promise = new Promise<void>((resolve) => {
    resolver = resolve;
  });
  return { promise, resolver };
}

describe('Edições concorrentes de cadastros (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  const ator = () => ({
    ...usuarios.GESTOR,
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR' as const,
  });

  async function aguardarLock(tabela: string, fim: { valor: boolean }) {
    const limite = Date.now() + 3000;
    while (!fim.valor && Date.now() < limite) {
      const [row] = await prisma.$queryRaw<{ bloqueada: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query LIKE ${`%FROM ${tabela}%FOR UPDATE%`}) AS bloqueada
      `;
      if (row.bloqueada) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (!fim.valor)
      throw new Error('A segunda edição não chegou ao bloqueio esperado');
  }

  for (const tipo of ['loteamento', 'lote', 'cliente'] as const) {
    it(`preserva os campos de dois PATCHs simultâneos de ${tipo}`, async () => {
      const loteamento = await prisma.loteamento.create({
        data: { nome: 'Inicial', descricao: 'Antiga' },
      });
      const quadra = await prisma.quadra.create({
        data: { loteamentoId: loteamento.id, numero: 'A' },
      });
      const lote = await prisma.lote.create({
        data: { quadraId: quadra.id, numero: '1', areaM2: '100', valor: '500' },
      });
      const cliente = await prisma.cliente.create({
        data: { nome: 'Cliente', documento: '52998224725' },
      });
      const primeiraGravacao = sinal();
      const liberar = sinal();
      const segundaLeitura = sinal();
      const fim = { valor: false };
      const executar =
        tipo === 'loteamento'
          ? (n: number) =>
              app
                .get(LoteamentoService)
                .update(
                  loteamento.id,
                  n === 1
                    ? { descricao: 'Nova' }
                    : { localizacao: 'Local novo' },
                  ator(),
                )
          : tipo === 'lote'
            ? (n: number) =>
                app
                  .get(LoteService)
                  .update(
                    lote.id,
                    n === 1
                      ? { valor: '600' }
                      : { observacoes: 'Nova observação' },
                    ator(),
                  )
            : (n: number) =>
                app
                  .get(ClienteService)
                  .update(
                    cliente.id,
                    n === 1
                      ? { telefone: '45999999999' }
                      : { email: 'novo@exemplo.com' },
                    usuarios.GESTOR.id,
                  );

      // Bloqueia a primeira gravação após a leitura e observa a segunda leitura.
      const instrumentar = <
        T extends { findById: (...args: never[]) => unknown },
      >(
        repo: T,
      ) => {
        const original = repo.findById.bind(repo);
        let chamadas = 0;
        vi.spyOn(repo, 'findById').mockImplementation((async (
          ...args: never[]
        ) => {
          const chamada = ++chamadas;
          const result = await original(...args);
          if (chamada === 2) segundaLeitura.resolver();
          return result;
        }) as T['findById']);
      };
      if (tipo === 'cliente') {
        const repo = app.get<PrismaClienteRepository>(CLIENTE_REPOSITORY);
        instrumentar(repo);
        const original = repo.save.bind(repo);
        vi.spyOn(repo, 'save').mockImplementationOnce(async (...args) => {
          primeiraGravacao.resolver();
          await liberar.promise;
          return original(...args);
        });
      } else if (tipo === 'lote') {
        const repo = app.get<PrismaLoteRepository>(LOTE_REPOSITORY);
        instrumentar(repo);
        const original = repo.update.bind(repo);
        vi.spyOn(repo, 'update').mockImplementationOnce(async (...args) => {
          primeiraGravacao.resolver();
          await liberar.promise;
          return original(...args);
        });
      } else {
        const repo = app.get<PrismaLoteamentoRepository>(LOTEAMENTO_REPOSITORY);
        instrumentar(repo);
        const original = repo.update.bind(repo);
        vi.spyOn(repo, 'update').mockImplementationOnce(async (...args) => {
          primeiraGravacao.resolver();
          await liberar.promise;
          return original(...args);
        });
      }
      const a = executar(1);
      await primeiraGravacao.promise;
      const b = executar(2);
      const observacao = aguardarLock(
        tipo === 'cliente'
          ? 'clientes'
          : tipo === 'lote'
            ? 'lotes'
            : 'loteamentos',
        fim,
      );
      try {
        await Promise.race([segundaLeitura.promise, observacao]);
      } finally {
        fim.valor = true;
        liberar.resolver();
      }
      await Promise.all([a, b, observacao]);
      if (tipo === 'loteamento') {
        expect(
          await prisma.loteamento.findUnique({ where: { id: loteamento.id } }),
        ).toMatchObject({ descricao: 'Nova', localizacao: 'Local novo' });
        const eventos = await prisma.historicoAuditoria.findMany({
          where: { entidadeId: loteamento.id, acao: 'ALTERAR' },
        });
        expect(eventos).toHaveLength(2);
        expect(
          eventos.some(
            (e) =>
              (e.valorAnterior as { descricao: string }).descricao === 'Nova',
          ),
        ).toBe(true);
      } else if (tipo === 'lote') {
        const atual = await prisma.lote.findUniqueOrThrow({
          where: { id: lote.id },
        });
        expect(atual.valor?.toFixed(2)).toBe('600.00');
        expect(atual.observacoes).toBe('Nova observação');
      } else {
        expect(
          await prisma.cliente.findUnique({ where: { id: cliente.id } }),
        ).toMatchObject({ telefone: '45999999999', email: 'novo@exemplo.com' });
      }
    });
  }
});
