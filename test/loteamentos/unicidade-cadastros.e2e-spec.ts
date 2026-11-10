import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { LoteamentoService } from '../../src/modules/loteamentos/application/services/loteamento.service.js';
import { QuadraService } from '../../src/modules/loteamentos/application/services/quadra.service.js';
import { LoteService } from '../../src/modules/loteamentos/application/services/lote.service.js';
import { ImportacaoLotesService } from '../../src/modules/loteamentos/application/services/importacao-lotes.service.js';
import {
  LOTEAMENTO_REPOSITORY,
  type LoteamentoRepository,
} from '../../src/modules/loteamentos/domain/repositories/loteamento.repository.interface.js';
import {
  QUADRA_REPOSITORY,
  type QuadraRepository,
} from '../../src/modules/loteamentos/domain/repositories/quadra.repository.interface.js';
import {
  LOTE_REPOSITORY,
  type LoteRepository,
} from '../../src/modules/loteamentos/domain/repositories/lote.repository.interface.js';
import { limparBanco } from '../helpers/database.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';

describe('Unicidade sem diferenciar caixa (integração)', () => {
  let app: INestApplication, prisma: PrismaService, usuarios: UsuariosTeste;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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

  for (const tipo of ['loteamento', 'quadra', 'lote'] as const) {
    for (const operacao of ['criar', 'renomear'] as const) {
      it(`${tipo}: duas operações de ${operacao} com pré-check desatualizado resultam em um sucesso e um conflito específico`, async () => {
        const pai = await prisma.loteamento.create({ data: { nome: 'Pai' } });
        const quadra = await prisma.quadra.create({
          data: { loteamentoId: pai.id, numero: 'Pai' },
        });
        const ids: string[] = [];
        if (operacao === 'renomear') {
          for (const numero of ['Antigo A', 'Antigo B']) {
            const registro =
              tipo === 'loteamento'
                ? await prisma.loteamento.create({ data: { nome: numero } })
                : tipo === 'quadra'
                  ? await prisma.quadra.create({
                      data: { loteamentoId: pai.id, numero },
                    })
                  : await prisma.lote.create({
                      data: { quadraId: quadra.id, numero, areaM2: '100' },
                    });
            ids.push(registro.id);
          }
        }
        // Simula o pré-check que passou antes de uma escrita concorrente.
        // O índice do Postgres precisa garantir a regra mesmo sem esse auxílio.
        if (tipo === 'loteamento')
          vi.spyOn(
            app.get<LoteamentoRepository>(LOTEAMENTO_REPOSITORY),
            'existsByNome',
          ).mockResolvedValue(false);
        else if (tipo === 'quadra')
          vi.spyOn(
            app.get<QuadraRepository>(QUADRA_REPOSITORY),
            'existsByNumero',
          ).mockResolvedValue(false);
        else
          vi.spyOn(
            app.get<LoteRepository>(LOTE_REPOSITORY),
            'existsByNumero',
          ).mockResolvedValue(false);
        const resultados = await Promise.allSettled(
          ['Bela Vista', 'bela vista'].map((nome, index) => {
            if (tipo === 'loteamento')
              return operacao === 'criar'
                ? app.get(LoteamentoService).create({ nome }, ator())
                : app
                    .get(LoteamentoService)
                    .update(ids[index], { nome }, ator());
            if (tipo === 'quadra')
              return operacao === 'criar'
                ? app
                    .get(QuadraService)
                    .create(pai.id, { numero: nome }, ator())
                : app
                    .get(QuadraService)
                    .update(ids[index], { numero: nome }, ator());
            return operacao === 'criar'
              ? app
                  .get(LoteService)
                  .create(
                    { quadraId: quadra.id, numero: nome, areaM2: '100' },
                    ator(),
                  )
              : app
                  .get(LoteService)
                  .update(ids[index], { numero: nome }, ator());
          }),
        );
        expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
          1,
        );
        expect(resultados.find((r) => r.status === 'rejected')).toMatchObject({
          status: 'rejected',
          reason: { code: `${tipo.toUpperCase()}_JA_EXISTE` },
        });
        const entidadeTipo =
          tipo === 'loteamento'
            ? 'Loteamento'
            : tipo === 'quadra'
              ? 'Quadra'
              : 'Lote';
        expect(
          await prisma.historicoAuditoria.count({
            where: {
              entidadeTipo,
              acao: operacao === 'criar' ? 'CRIAR' : 'ALTERAR',
            },
          }),
        ).toBe(1);
        const registros =
          tipo === 'loteamento'
            ? (await prisma.loteamento.findMany()).map((r) => r.nome)
            : tipo === 'quadra'
              ? (await prisma.quadra.findMany()).map((r) => r.numero)
              : (await prisma.lote.findMany()).map((r) => r.numero);
        expect(
          registros.filter((s) => s.toLowerCase() === 'bela vista'),
        ).toHaveLength(1);
        expect(
          registros.some((s) => s === 'Bela Vista' || s === 'bela vista'),
        ).toBe(true);
      });
    }
    it(`${tipo}: permite reutilização após soft delete e respeita o escopo do pai`, async () => {
      const pais = await Promise.all(
        ['Pai 1', 'Pai 2'].map((nome) =>
          prisma.loteamento.create({ data: { nome } }),
        ),
      );
      const quadras = await Promise.all(
        pais.map((pai) =>
          prisma.quadra.create({ data: { loteamentoId: pai.id, numero: 'A' } }),
        ),
      );
      if (tipo === 'loteamento') {
        await prisma.loteamento.create({
          data: { nome: 'Bela Vista', deletedAt: new Date() },
        });
        expect(
          (
            await app
              .get(LoteamentoService)
              .create({ nome: 'bela vista' }, ator())
          ).nome,
        ).toBe('bela vista');
      } else if (tipo === 'quadra') {
        await prisma.quadra.update({
          where: { id: quadras[0].id },
          data: { deletedAt: new Date() },
        });
        expect(
          (
            await app
              .get(QuadraService)
              .create(pais[0].id, { numero: 'a' }, ator())
          ).numero,
        ).toBe('a');
        expect(await prisma.quadra.count({ where: { deletedAt: null } })).toBe(
          2,
        );
      } else {
        await prisma.lote.create({
          data: {
            quadraId: quadras[0].id,
            numero: 'A',
            areaM2: '100',
            deletedAt: new Date(),
          },
        });
        await app
          .get(LoteService)
          .create(
            { quadraId: quadras[0].id, numero: 'a', areaM2: '100' },
            ator(),
          );
        await app
          .get(LoteService)
          .create(
            { quadraId: quadras[1].id, numero: 'A', areaM2: '100' },
            ator(),
          );
        expect(await prisma.lote.count({ where: { deletedAt: null } })).toBe(2);
      }
    });
  }
  it('conflito na importação desfaz lotes novos e sua auditoria', async () => {
    const pai = await prisma.loteamento.create({ data: { nome: 'Pai' } });
    const quadra = await prisma.quadra.create({
      data: { loteamentoId: pai.id, numero: 'A' },
    });
    await prisma.lote.create({
      data: { quadraId: quadra.id, numero: 'Existente', areaM2: '100' },
    });
    // Um INSERT externo concorrente pode tornar o plano desatualizado.
    vi.spyOn(
      app.get<LoteRepository>(LOTE_REPOSITORY),
      'findByQuadraIds',
    ).mockResolvedValue([]);
    await expect(
      app.get(ImportacaoLotesService).importar(
        {
          nome: 'lotes.csv',
          conteudo: Buffer.from(
            'loteamento;quadra;numero;area_m2\nPai;A;Novo;100\nPai;A;existente;100',
          ),
        },
        { confirmar: true },
        ator(),
      ),
    ).rejects.toMatchObject({ code: 'LOTE_JA_EXISTE' });
    expect(await prisma.lote.count()).toBe(1);
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });
});
