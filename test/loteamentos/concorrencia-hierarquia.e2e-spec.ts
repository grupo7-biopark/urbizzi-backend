import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { LoteamentoService } from '../../src/modules/loteamentos/application/services/loteamento.service.js';
import { QuadraService } from '../../src/modules/loteamentos/application/services/quadra.service.js';
import { LoteService } from '../../src/modules/loteamentos/application/services/lote.service.js';
import { ImportacaoLotesService } from '../../src/modules/loteamentos/application/services/importacao-lotes.service.js';
import type { LoteamentoRepository } from '../../src/modules/loteamentos/domain/repositories/loteamento.repository.interface.js';
import { LOTEAMENTO_REPOSITORY } from '../../src/modules/loteamentos/domain/repositories/loteamento.repository.interface.js';
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
import { criarSinal, aguardarBloqueio } from '../helpers/concorrencia.js';

describe('Integridade da hierarquia em concorrência (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;
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

  for (const pai of ['loteamento', 'quadra'] as const) {
    for (const primeiro of ['criar', 'excluir'] as const) {
      it(`${pai}: ${primeiro} vence sem deixar filho de pai excluído`, async () => {
        const loteamento = await prisma.loteamento.create({
          data: { nome: 'Residencial' },
        });
        const quadra =
          pai === 'quadra'
            ? await prisma.quadra.create({
                data: { loteamentoId: loteamento.id, numero: 'A' },
              })
            : null;
        const repoPai =
          pai === 'loteamento'
            ? app.get<LoteamentoRepository>(LOTEAMENTO_REPOSITORY)
            : app.get<QuadraRepository>(QUADRA_REPOSITORY);
        const entrou = criarSinal(),
          liberar = criarSinal();
        const excluir = () =>
          pai === 'loteamento'
            ? app.get(LoteamentoService).delete(loteamento.id, ator())
            : app.get(QuadraService).delete(quadra!.id, ator());
        const criar = () =>
          pai === 'loteamento'
            ? app
                .get(QuadraService)
                .create(loteamento.id, { numero: 'B' }, ator())
            : app
                .get(LoteService)
                .create(
                  { quadraId: quadra!.id, numero: '1', areaM2: '100' },
                  ator(),
                );
        if (primeiro === 'excluir') {
          const original = repoPai.delete.bind(repoPai);
          vi.spyOn(repoPai, 'delete').mockImplementationOnce(
            async (...args) => {
              entrou.liberar();
              await liberar.promise;
              return original(...args);
            },
          );
        } else if (pai === 'loteamento') {
          const repo = app.get<QuadraRepository>(QUADRA_REPOSITORY),
            original = repo.create.bind(repo);
          vi.spyOn(repo, 'create').mockImplementationOnce(async (...args) => {
            entrou.liberar();
            await liberar.promise;
            return original(...args);
          });
        } else {
          const repo = app.get<LoteRepository>(LOTE_REPOSITORY),
            original = repo.create.bind(repo);
          vi.spyOn(repo, 'create').mockImplementationOnce(async (...args) => {
            entrou.liberar();
            await liberar.promise;
            return original(...args);
          });
        }
        const a = primeiro === 'criar' ? criar() : excluir();
        await entrou.promise;
        const b = primeiro === 'criar' ? excluir() : criar();
        const resultado = Promise.allSettled([a, b]);
        try {
          await aguardarBloqueio(
            prisma,
            pai === 'loteamento' ? 'loteamentos' : 'quadras',
          );
        } finally {
          liberar.liberar();
        }
        const [vencedora, perdedora] = await resultado;
        expect(vencedora.status).toBe('fulfilled');
        expect(perdedora).toMatchObject({
          status: 'rejected',
          reason: {
            code:
              primeiro === 'criar'
                ? pai === 'loteamento'
                  ? 'LOTEAMENTO_COM_QUADRAS'
                  : 'QUADRA_COM_LOTES'
                : pai === 'loteamento'
                  ? 'LOTEAMENTO_NAO_ENCONTRADO'
                  : 'QUADRA_NAO_ENCONTRADA',
          },
        });
        const atual =
          pai === 'loteamento'
            ? await prisma.loteamento.findUniqueOrThrow({
                where: { id: loteamento.id },
              })
            : await prisma.quadra.findUniqueOrThrow({
                where: { id: quadra!.id },
              });
        expect(atual.deletedAt === null).toBe(primeiro === 'criar');
        expect(
          pai === 'loteamento'
            ? await prisma.quadra.count()
            : await prisma.lote.count(),
        ).toBe(primeiro === 'criar' ? 1 : 0);
      });
    }
    it(`importação revalida ${pai} excluído depois de planejar e desfaz tudo`, async () => {
      const loteamento = await prisma.loteamento.create({
        data: { nome: 'Residencial' },
      });
      const quadra =
        pai === 'quadra'
          ? await prisma.quadra.create({
              data: { loteamentoId: loteamento.id, numero: 'A' },
            })
          : null;
      if (pai === 'loteamento') {
        const repo = app.get<QuadraRepository>(QUADRA_REPOSITORY),
          original = repo.findByLoteamentoIds.bind(repo);
        vi.spyOn(repo, 'findByLoteamentoIds').mockImplementationOnce(
          async (...args) => {
            const result = await original(...args);
            await app.get(LoteamentoService).delete(loteamento.id, ator());
            return result;
          },
        );
      } else {
        const repo = app.get<LoteRepository>(LOTE_REPOSITORY),
          original = repo.findByQuadraIds.bind(repo);
        vi.spyOn(repo, 'findByQuadraIds').mockImplementationOnce(
          async (...args) => {
            const result = await original(...args);
            await app.get(QuadraService).delete(quadra!.id, ator());
            return result;
          },
        );
      }
      const conteudo = Buffer.from(
        'loteamento;quadra;numero;area_m2\nResidencial;A;1;100\nOutro;Z;2;100',
      );
      await expect(
        app
          .get(ImportacaoLotesService)
          .importar(
            { nome: 'lotes.csv', conteudo },
            { confirmar: true, criarCadastros: true },
            ator(),
          ),
      ).rejects.toMatchObject({
        code:
          pai === 'loteamento'
            ? 'LOTEAMENTO_NAO_ENCONTRADO'
            : 'QUADRA_NAO_ENCONTRADA',
      });
      expect(await prisma.lote.count()).toBe(0);
      expect(await prisma.loteamento.count({ where: { nome: 'Outro' } })).toBe(
        0,
      );
      expect(
        await prisma.historicoAuditoria.count({
          where: { motivo: 'Importação de planilha' },
        }),
      ).toBe(0);
    });
  }
});
