import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { adicionarDiasUteis } from '../../src/shared/domain/dias-uteis.js';
describe('Propostas (e2e)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    c: Awaited<ReturnType<typeof criarCenarioMapa>>,
    reservaId: string;
  const dto = {
    valor: '123456.78',
    condicoes: 'Pagamento confidencial',
    observacoes: 'Observação privada',
  };
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
    const r = await request(app.getHttpServer())
      .post('/v1/reservas')
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .send({ loteId: c.lotes[0].id, clienteId: c.cliente.id })
      .expect(201);
    reservaId = r.body.id;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  const url = () => '/v1/reservas/' + reservaId + '/propostas';
  const criar = (perfil: keyof typeof c.usuarios = 'COMERCIAL') =>
    request(app.getHttpServer())
      .post(url())
      .auth(c.usuarios[perfil].token, { type: 'bearer' })
      .send(dto);
  it('cria com prazo configurado, consulta, lista e audita sem alterar lote', async () => {
    await prisma.configuracao.create({
      data: { chave: 'prazo_analise_dias_uteis', valor: '3' },
    });
    const p = (await criar().expect(201)).body;
    expect(p).toMatchObject({
      status: 'EM_ANALISE',
      vendedorId: c.usuarios.COMERCIAL.id,
      valor: dto.valor,
    });
    expect(p.prazoLimite).toBe(
      adicionarDiasUteis(new Date(p.dataEnvio), 3).toISOString(),
    );
    await request(app.getHttpServer())
      .get('/v1/propostas/' + p.id)
      .auth(c.usuarios.COMERCIAL.token, { type: 'bearer' })
      .expect(200);
    const list = await request(app.getHttpServer())
      .get(url() + '?pageSize=1')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: c.lotes[0].id } }))
        .status,
    ).toBe('RESERVADO');
    const audit = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: p.id },
    });
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(dto.condicoes);
    expect(JSON.stringify(audit)).not.toContain(dto.observacoes);
  });
  it('permite só uma proposta concorrente e rejeita a segunda', async () => {
    const r = await Promise.all([criar(), criar()]);
    expect(r.map((v) => v.status).sort()).toEqual([201, 409]);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(1);
  });
  it('preserva rejeitada e permite novo envio sem aceitar proposta após aprovação', async () => {
    const antiga = (await criar().expect(201)).body;
    await prisma.proposta.update({
      where: { id: antiga.id },
      data: {
        status: 'REJEITADA',
        decididoPorId: c.usuarios.GESTOR.id,
        dataDecisao: new Date(),
        motivoDecisao: 'Rejeitada no cenário de teste',
      },
    });
    const nova = (await criar('GESTOR').expect(201)).body;
    expect(nova.vendedorId).toBe(c.usuarios.COMERCIAL.id);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(2);
    await prisma.proposta.update({
      where: { id: nova.id },
      data: {
        status: 'APROVADA',
        decididoPorId: c.usuarios.GESTOR.id,
        dataDecisao: new Date(),
        motivoDecisao: 'Aprovada no cenário de teste',
      },
    });
    expect((await criar().expect(409)).body.code).toBe('PROPOSTA_JA_APROVADA');
  });
  it.each(['EXPIRADA', 'CANCELADA', 'CONVERTIDA', 'VENCIDA'] as const)(
    'nega reserva %s',
    async (status) => {
      await prisma.reserva.update({
        where: { id: reservaId },
        data:
          status === 'VENCIDA'
            ? {
                dataInicio: new Date(Date.now() - 86400000),
                dataVencimento: new Date(Date.now() - 1000),
              }
            : { status },
      });
      expect((await criar().expect(409)).body.code).toBe(
        'RESERVA_INVALIDA_PARA_PROPOSTA',
      );
    },
  );
  it('nega Consulta e outro vendedor na criação e leitura', async () => {
    const p = (await criar().expect(201)).body;
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    for (const token of [outro.token, c.usuarios.CONSULTA.token]) {
      await request(app.getHttpServer())
        .post(url())
        .auth(token, { type: 'bearer' })
        .send(dto)
        .expect(403);
      await request(app.getHttpServer())
        .get(url())
        .auth(token, { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .get('/v1/propostas/' + p.id)
        .auth(token, { type: 'bearer' })
        .expect(403);
    }
  });
  it('aceita Admin, exige login e valida corpo, paginação e recursos', async () => {
    await request(app.getHttpServer()).post(url()).send(dto).expect(401);
    for (const invalid of [
      { ...dto, valor: '0' },
      { ...dto, valor: '1.001' },
      { ...dto, condicoes: ' ' },
      { ...dto, vendedorId: randomUUID() },
    ])
      await request(app.getHttpServer())
        .post(url())
        .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
        .send(invalid)
        .expect(400);
    await criar('ADMINISTRADOR').expect(201);
    await request(app.getHttpServer())
      .get(url() + '?page=0')
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/propostas/' + randomUUID())
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/v1/reservas/' + randomUUID() + '/propostas')
      .auth(c.usuarios.ADMINISTRADOR.token, { type: 'bearer' })
      .send(dto)
      .expect(404);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(
      doc.paths['/v1/reservas/{reservaId}/propostas'].post?.responses,
    ).toHaveProperty('409');
  });
  it('reverte escrita se auditoria falhar', async () => {
    vi.spyOn(app.get(AuditoriaService), 'registrar').mockRejectedValue(
      new Error('Falha simulada'),
    );
    await criar().expect(500);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(0);
  });

  it('revalida a reserva depois de aguardar uma alteração concorrente', async () => {
    let liberar!: () => void;
    let sinalizar!: () => void;
    const pausa = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const entrou = new Promise<void>((resolve) => {
      sinalizar = resolve;
    });
    const alteracao = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM reservas WHERE id = ${reservaId}::uuid FOR UPDATE`;
        sinalizar();
        await pausa;
        await tx.reserva.update({
          where: { id: reservaId },
          data: { status: 'EXPIRADA' },
        });
      },
      { timeout: 10000 },
    );
    await entrou;
    const envio = criar().then((response) => response);
    try {
      let aguardando = false;
      const limite = Date.now() + 3000;
      while (Date.now() < limite && !aguardando) {
        const rows = await prisma.$queryRaw<
          { bloqueadas: number }[]
        >`SELECT count(*)::int AS bloqueadas FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%reservas%'`;
        aguardando = rows[0].bloqueadas > 0;
        if (!aguardando)
          await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(aguardando).toBe(true);
    } finally {
      liberar();
    }
    await alteracao;
    expect((await envio).status).toBe(409);
    expect(await prisma.proposta.count({ where: { reservaId } })).toBe(0);
  });
});
