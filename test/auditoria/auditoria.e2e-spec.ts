import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { TransactionManager } from '../../src/shared/infra/database/transaction.manager.js';
import { limparBanco } from '../helpers/database.js';
describe('Auditoria (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditoria: AuditoriaService;
  let manager: TransactionManager;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    auditoria = app.get(AuditoriaService);
    manager = app.get(TransactionManager);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('persiste alteração e histórico mascarado juntos', async () => {
    const id = randomUUID();
    await manager.run(async (tx) => {
      await tx.configuracao.create({
        data: { id, chave: 'prazo', valor: '7' },
      });
      await auditoria.registrar(
        {
          entidadeTipo: 'Configuracao',
          entidadeId: id,
          acao: 'CRIAR',
          valorNovo: {
            valor: '7',
            senhaHash: 'segredo',
            itens: [{ token: 'segredo' }],
          },
        },
        tx,
      );
    });
    expect(await prisma.configuracao.count()).toBe(1);
    const h = await prisma.historicoAuditoria.findFirstOrThrow();
    expect(h.valorNovo).toEqual({
      valor: '7',
      senhaHash: '[MASCARADO]',
      itens: [{ token: '[MASCARADO]' }],
    });
    expect(h.usuarioId).toBeNull();
    expect(h.valorAnterior).toBeNull();
  });
  it('desfaz ambos ao falhar depois da auditoria', async () => {
    await expect(
      manager.run(async (tx) => {
        const c = await tx.configuracao.create({
          data: { chave: 'prazo', valor: '7' },
        });
        await auditoria.registrar(
          { entidadeTipo: 'Configuracao', entidadeId: c.id, acao: 'CRIAR' },
          tx,
        );
        throw new Error('Falha forçada');
      }),
    ).rejects.toThrow('Falha forçada');
    expect(await prisma.configuracao.count()).toBe(0);
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });
  it('desfaz alteração se a gravação da auditoria falhar', async () => {
    await expect(
      manager.run(async (tx) => {
        const c = await tx.configuracao.create({
          data: { chave: 'prazo', valor: '7' },
        });
        await auditoria.registrar(
          {
            usuarioId: randomUUID(),
            entidadeTipo: 'Configuracao',
            entidadeId: c.id,
            acao: 'CRIAR',
          },
          tx,
        );
      }),
    ).rejects.toThrow();
    expect(await prisma.configuracao.count()).toBe(0);
    expect(await prisma.historicoAuditoria.count()).toBe(0);
  });
  it('registra sem transação explícita', async () => {
    await auditoria.registrar({
      entidadeTipo: 'Lote',
      entidadeId: randomUUID(),
      acao: 'ALTERAR',
      valorAnterior: 'DISPONIVEL',
      valorNovo: 'RESERVADO',
      motivo: 'Reserva',
    });
    expect(await prisma.historicoAuditoria.count()).toBe(1);
  });
});
