import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { ConfiguracaoService } from '../../src/modules/configuracoes/application/services/configuracao.service.js';
describe('Configurações (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    token = (await criarUsuarioTeste(app, 'ADMINISTRADOR')).token;
    await app
      .get(ConfiguracaoService)
      .update(
        { prazoReservaDias: 7, prazoAnaliseDiasUteis: 7 },
        (await prisma.usuario.findFirstOrThrow()).id,
      );
    await prisma.historicoAuditoria.deleteMany();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('lista e atualiza prazos, com auditoria e cache atualizado', async () => {
    const initial = await request(app.getHttpServer())
      .get('/v1/configuracoes?pageSize=1')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(initial.body.meta).toMatchObject({ total: 2, pageSize: 1 });
    const result = await request(app.getHttpServer())
      .patch('/v1/configuracoes')
      .auth(token, { type: 'bearer' })
      .send({ prazoReservaDias: 10, prazoAnaliseDiasUteis: 5 })
      .expect(200);
    expect(result.body).toEqual({
      prazoReservaDias: 10,
      prazoAnaliseDiasUteis: 5,
    });
    expect(await app.get(ConfiguracaoService).getPrazoReservaDias()).toBe(10);
    expect(await prisma.historicoAuditoria.count()).toBe(2);
  });
  it.each([0, -1, 1.2, null, '7'])(
    'rejeita prazo inválido %j',
    async (valor) => {
      const res = await request(app.getHttpServer())
        .patch('/v1/configuracoes')
        .auth(token, { type: 'bearer' })
        .send({ prazoReservaDias: valor })
        .expect(400);
      expect(res.body.code).toBe('DADOS_INVALIDOS');
    },
  );
  it('rejeita corpo vazio ou chave desconhecida', async () => {
    await request(app.getHttpServer())
      .patch('/v1/configuracoes')
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(422);
    await request(app.getHttpServer())
      .patch('/v1/configuracoes')
      .auth(token, { type: 'bearer' })
      .send({ limiteRenovacoes: 1 })
      .expect(400);
  });
  it('nega demais perfis e acesso anônimo', async () => {
    await request(app.getHttpServer()).get('/v1/configuracoes').expect(401);
    for (const perfil of ['GESTOR', 'COMERCIAL', 'CONSULTA'] as const) {
      const usuario = await criarUsuarioTeste(app, perfil);
      await request(app.getHttpServer())
        .get('/v1/configuracoes')
        .auth(usuario.token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .patch('/v1/configuracoes')
        .auth(usuario.token, { type: 'bearer' })
        .send({ prazoReservaDias: 9 })
        .expect(403);
    }
  });
  it('falha na auditoria desfaz alteração e preserva cache', async () => {
    const spy = vi
      .spyOn(app.get(AuditoriaService), 'registrar')
      .mockRejectedValueOnce(new Error('Falha forçada'));
    try {
      await request(app.getHttpServer())
        .patch('/v1/configuracoes')
        .auth(token, { type: 'bearer' })
        .send({ prazoReservaDias: 20 })
        .expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(
      (
        await prisma.configuracao.findUniqueOrThrow({
          where: { chave: 'prazo_reserva_dias' },
        })
      ).valor,
    ).toBe('7');
    expect(await app.get(ConfiguracaoService).getPrazoReservaDias()).toBe(7);
  });
  it('serializa alterações concorrentes com histórico coerente', async () => {
    await Promise.all(
      [10, 20].map((valor) =>
        request(app.getHttpServer())
          .patch('/v1/configuracoes')
          .auth(token, { type: 'bearer' })
          .send({ prazoReservaDias: valor })
          .expect(200),
      ),
    );
    const rows = await prisma.historicoAuditoria.findMany();
    expect(rows).toHaveLength(2);
    expect(
      rows.filter(
        (row) => (row.valorAnterior as { valor: number }).valor === 7,
      ),
    ).toHaveLength(1);
  });
});
