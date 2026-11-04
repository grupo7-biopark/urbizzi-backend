import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { limparBanco } from '../helpers/database.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
describe('Mapa público por token (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let c: Awaited<ReturnType<typeof criarCenarioMapa>>;
  beforeEach(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    await limparBanco(prisma);
    c = await criarCenarioMapa(app);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });
  async function link(loteamentoId: string | null = null) {
    return prisma.linkPublico.create({
      data: {
        token: randomBytes(32).toString('base64url'),
        criadoPorId: c.usuarios.COMERCIAL.id,
        loteamentoId,
      },
    });
  }
  const get = (token: string, query = '') =>
    request(app.getHttpServer()).get('/v1/publico/' + token + query);
  it('retorna mapa sem login com contrato estrito e valores apenas autorizados', async () => {
    const l = await link();
    const res = await get(l.token).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(Object.keys(res.body).sort()).toEqual([
      'contatoComercial',
      'marcadores',
      'planta',
    ]);
    expect(res.body.contatoComercial).toBe(
      app.get(ConfigService).get('PUBLICO_CONTATO_COMERCIAL'),
    );
    expect(Object.keys(res.body.planta).sort()).toEqual(
      [
        'id',
        'nome',
        'versao',
        'larguraPx',
        'alturaPx',
        'maxZoom',
        'tamanhoTile',
        'tilesUrl',
      ].sort(),
    );
    expect(res.body.marcadores.meta.total).toBe(4);
    for (const item of res.body.marcadores.data) {
      const autorizado = c.lotes.find(
        (lote) => lote.id === item.loteId,
      )?.exibirValorPublico;
      expect(Object.keys(item).sort()).toEqual(
        [
          'id',
          'loteId',
          'x',
          'y',
          'numero',
          'quadraId',
          'quadra',
          'loteamentoId',
          'loteamento',
          'areaM2',
          'status',
          ...(autorizado ? ['valor'] : []),
        ].sort(),
      );
      if (autorizado) expect(item.valor).toBe('123456.78');
      else expect(item).not.toHaveProperty('valor');
    }
    const json = JSON.stringify(res.body);
    for (const dado of [
      c.cliente.nome,
      c.cliente.documento,
      c.cliente.telefone,
      c.usuarios.COMERCIAL.id,
      'Condição confidencial',
      'APROVADA',
      l.token,
    ])
      expect(json).not.toContain(dado);
    expect(
      (await prisma.linkPublico.findUniqueOrThrow({ where: { id: l.id } }))
        .acessos,
    ).toBe(1);
  });
  it('respeita escopo e paginação sem aceitar ampliação pelo cliente', async () => {
    const l = await link(c.loteamentos[0].id);
    const res = await get(l.token, '?pageSize=1').expect(200);
    expect(res.body.marcadores.meta).toMatchObject({ total: 2, totalPages: 2 });
    expect(res.body.marcadores.data).toHaveLength(1);
    expect(res.body.marcadores.data[0].loteamentoId).toBe(c.loteamentos[0].id);
    await get(l.token, '?loteamentoId=' + c.loteamentos[1].id).expect(400);
    await get(l.token, '?status=DISPONIVEL').expect(400);
    const segunda = await get(l.token, '?pageSize=1&page=2').expect(200);
    expect(segunda.body.marcadores.data[0].id).not.toBe(
      res.body.marcadores.data[0].id,
    );
  });
  it('token inválido, inexistente ou desativado responde 404 sem refletir segredos', async () => {
    const l = await link();
    await prisma.linkPublico.update({
      where: { id: l.id },
      data: { ativo: false },
    });
    for (const token of [
      'invalido',
      randomBytes(32).toString('base64url'),
      l.token,
    ]) {
      const res = await get(token).expect(404);
      expect(res.body.code).toBe('LINK_NAO_ENCONTRADO');
      expect(res.body.path).toBe('/v1/publico/:token');
      expect(JSON.stringify(res.body)).not.toContain(token);
    }
    expect(
      (await prisma.linkPublico.findUniqueOrThrow({ where: { id: l.id } }))
        .acessos,
    ).toBe(0);
  });
  it('conta acessos concorrentes sem perda de incrementos', async () => {
    const l = await link();
    await Promise.all(
      Array.from({ length: 8 }, () => get(l.token).expect(200)),
    );
    expect(
      (await prisma.linkPublico.findUniqueOrThrow({ where: { id: l.id } }))
        .acessos,
    ).toBe(8);
  });
  it('status e autorização do valor são atualizados a cada requisição', async () => {
    const l = await link();
    const interno = await request(app.getHttpServer())
      .get('/v1/mapa')
      .auth(c.usuarios.GESTOR.token, { type: 'bearer' })
      .expect(200);
    const publico = await get(l.token).expect(200);
    for (const item of publico.body.marcadores.data)
      expect(
        interno.body.marcadores.data.find(
          (i: { id: string }) => i.id === item.id,
        )?.status,
      ).toBe(item.status);
    await prisma.lote.update({
      where: { id: c.lotes[0].id },
      data: { status: 'BLOQUEADO', exibirValorPublico: false },
    });
    const atualizado = await get(l.token).expect(200);
    const item = atualizado.body.marcadores.data.find(
      (i: { loteId: string }) => i.loteId === c.lotes[0].id,
    );
    expect(item.status).toBe('BLOQUEADO');
    expect(item).not.toHaveProperty('valor');
    await prisma.planta.update({
      where: { id: c.planta.id },
      data: { ativa: false },
    });
    expect((await get(l.token).expect(404)).body.code).toBe(
      'PLANTA_ATIVA_NAO_ENCONTRADA',
    );
  });
  it('limita por IP mesmo alternando tokens e valida o Swagger sem campos internos', async () => {
    const a = await link();
    const b = await link();
    for (let i = 0; i < 60; i++)
      await get(i % 2 === 0 ? a.token : b.token).expect(200);
    const res = await get(a.token)
      .set('X-Forwarded-For', '198.51.100.2')
      .expect(429);
    expect(res.body.code).toBe('MUITAS_REQUISICOES');
    expect(res.body.path).toBe('/v1/publico/:token');
    const totais = await prisma.linkPublico.aggregate({
      _sum: { acessos: true },
    });
    expect(totais._sum.acessos).toBe(60);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    const props = doc.components?.schemas?.LotePublicoDto;
    expect(JSON.stringify(props)).not.toContain('vendedor');
    expect(JSON.stringify(props)).not.toContain('acoes');
    expect(doc.paths['/v1/publico/{token}'].get?.responses).toHaveProperty(
      '429',
    );
  });
});
