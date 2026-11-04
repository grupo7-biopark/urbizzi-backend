import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
describe('Mapa interno (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let c: Awaited<ReturnType<typeof criarCenarioMapa>>;
  beforeAll(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
  });
  const get = (perfil: keyof typeof c.usuarios = 'GESTOR', query = '') =>
    request(app.getHttpServer())
      .get('/v1/mapa' + query)
      .auth(c.usuarios[perfil].token, { type: 'bearer' });
  it.each(['ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA'] as const)(
    'retorna dados e ações para %s sem expor aprovação como status',
    async (perfil) => {
      const res = await get(perfil).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.planta).toMatchObject({
        id: c.planta.id,
        larguraPx: 1024,
      });
      expect(res.body.marcadores.meta.total).toBe(4);
      const disponivel = res.body.marcadores.data.find(
        (i: { loteId: string }) => i.loteId === c.lotes[0].id,
      );
      const reservado = res.body.marcadores.data.find(
        (i: { loteId: string }) => i.loteId === c.lotes[1].id,
      );
      expect(disponivel).toMatchObject({
        areaM2: '100.25',
        valor: '123456.78',
        status: 'DISPONIVEL',
        loteamento: 'Norte',
        quadra: 'A',
      });
      expect(reservado.status).toBe('RESERVADO');
      expect(reservado.acoes).toEqual(
        perfil === 'CONSULTA'
          ? []
          : perfil === 'COMERCIAL'
            ? ['verReserva']
            : ['verReserva', 'vender'],
      );
      for (const campo of [
        'cliente',
        'vendedorId',
        'propostaAprovada',
        'observacoes',
        'criadoPorId',
      ])
        expect(JSON.stringify(res.body)).not.toContain('"' + campo + '"');
      expect(JSON.stringify(res.body)).not.toContain('APROVADA');
    },
  );
  it('combina filtros e mantém total em página além do fim', async () => {
    const filtro =
      '?loteamentoId=' +
      c.loteamentos[0].id +
      '&status=DISPONIVEL,VENDIDO&pageSize=1';
    const res = await get('GESTOR', filtro).expect(200);
    expect(res.body.marcadores.data).toHaveLength(1);
    expect(res.body.marcadores.meta).toMatchObject({ total: 2, totalPages: 2 });
    const vazia = await get('GESTOR', filtro + '&page=9').expect(200);
    expect(vazia.body.marcadores).toMatchObject({
      data: [],
      meta: { total: 2 },
    });
    expect(
      (await get('GESTOR', '?loteamentoId=' + randomUUID()).expect(200)).body
        .marcadores.meta.total,
    ).toBe(0);
  });
  it('Comercial não vê ação da reserva de outro vendedor e status é lido novamente', async () => {
    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    const res = await request(app.getHttpServer())
      .get('/v1/mapa?status=RESERVADO')
      .auth(outro.token, { type: 'bearer' })
      .expect(200);
    expect(res.body.marcadores.data[0].acoes).toEqual([]);
    await prisma.lote.update({
      where: { id: c.lotes[0].id },
      data: { status: 'BLOQUEADO' },
    });
    const atual = await get('GESTOR', '?status=BLOQUEADO').expect(200);
    expect(atual.body.marcadores.meta.total).toBe(2);
    expect(
      atual.body.marcadores.data.every(
        (i: { acoes: string[] }) => i.acoes.join() === 'desbloquear',
      ),
    ).toBe(true);
  });
  it('exclui cadastros removidos e marcadores de outras plantas', async () => {
    await prisma.lote.update({
      where: { id: c.lotes[0].id },
      data: { deletedAt: new Date() },
    });
    await prisma.quadra.update({
      where: { id: c.quadras[1].id },
      data: { deletedAt: new Date() },
    });
    const p = await prisma.planta.create({
      data: {
        nome: 'Antiga',
        versao: 2,
        status: 'PRONTA',
        criadoPorId: c.usuarios.GESTOR.id,
      },
    });
    await prisma.marcador.create({
      data: { plantaId: p.id, loteId: c.lotes[2].id, x: 0, y: 0 },
    });
    expect((await get().expect(200)).body.marcadores.meta.total).toBe(1);
    await prisma.loteamento.update({
      where: { id: c.loteamentos[0].id },
      data: { deletedAt: new Date() },
    });
    expect((await get().expect(200)).body.marcadores.meta.total).toBe(0);
  });
  it('exige login e valida filtros e ausência de planta ativa', async () => {
    await request(app.getHttpServer()).get('/v1/mapa').expect(401);
    for (const q of [
      '?status=APROVADA',
      '?status=DISPONIVEL,INVALIDO',
      '?loteamentoId=x',
      '?pageSize=101',
      '?page=0',
    ])
      await get('GESTOR', q).expect(400);
    await prisma.planta.update({
      where: { id: c.planta.id },
      data: { ativa: false },
    });
    expect((await get().expect(404)).body.code).toBe(
      'PLANTA_ATIVA_NAO_ENCONTRADA',
    );
  });
  it('consulta milhares de lotes sem N+1 e documenta o contrato', async () => {
    const extras = Array.from({ length: 2000 }, (_, i) => ({
      id: randomUUID(),
      quadraId: c.quadras[0].id,
      numero: 'Extra' + i,
      areaM2: '100.00',
    }));
    await prisma.lote.createMany({ data: extras });
    await prisma.marcador.createMany({
      data: extras.map((l) => ({
        plantaId: c.planta.id,
        loteId: l.id,
        x: 0,
        y: 0,
      })),
    });
    const query = vi.spyOn(prisma, '$queryRaw');
    const res = await get('GESTOR', '?pageSize=100').expect(200);
    expect(res.body.marcadores.meta.total).toBe(2004);
    expect(res.body.marcadores.data).toHaveLength(100);
    expect(query).toHaveBeenCalledTimes(1);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(doc.paths['/v1/mapa'].get?.responses).toHaveProperty('200');
    expect(doc.components?.schemas?.MapaDto).toBeDefined();
  });
});
