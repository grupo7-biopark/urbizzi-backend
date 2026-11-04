import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';
import { limparBanco } from '../helpers/database.js';
describe('Listagem de reservas (e2e)', () => {
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
    for (const [i, status] of (
      ['ATIVA', 'CANCELADA', 'EXPIRADA', 'CONVERTIDA'] as const
    ).entries()) {
      const lote = await prisma.lote.create({
        data: { quadraId: c.quadras[0].id, numero: 'Extra' + i, areaM2: '100' },
      });
      await prisma.reserva.create({
        data: {
          loteId: lote.id,
          clienteId: c.cliente.id,
          vendedorId: i === 0 ? c.usuarios.GESTOR.id : c.usuarios.COMERCIAL.id,
          status,
          dataInicio: new Date(Date.now() - 10 * 86400000),
          dataVencimento: new Date(Date.now() + (i + 2) * 86400000),
        },
      });
    }
  });
  afterAll(async () => {
    await app?.close();
  });
  const get = (perfil: keyof typeof c.usuarios = 'GESTOR', path = '') =>
    request(app.getHttpServer())
      .get('/v1/reservas' + path)
      .auth(c.usuarios[perfil].token, { type: 'bearer' });
  it('gestão vê todas, Comercial só próprias, minhas ignora filtro de outro vendedor', async () => {
    expect((await get().expect(200)).body.meta.total).toBe(5);
    expect((await get('ADMINISTRADOR').expect(200)).body.meta.total).toBe(5);
    const r = await get(
      'COMERCIAL',
      '?vendedorId=' + c.usuarios.GESTOR.id,
    ).expect(200);
    expect(r.body.meta.total).toBe(4);
    expect(
      r.body.data.every(
        (x: { vendedorId: string }) => x.vendedorId === c.usuarios.COMERCIAL.id,
      ),
    ).toBe(true);
    expect(
      (
        await get(
          'GESTOR',
          '/minhas?vendedorId=' + c.usuarios.COMERCIAL.id,
        ).expect(200)
      ).body.meta.total,
    ).toBe(1);
  });
  it('inclui apenas resumos e proposta atual sem contatos ou condições', async () => {
    const r = await get(
      'GESTOR',
      '?loteamentoId=' + c.loteamentos[1].id,
    ).expect(200);
    expect(r.body.meta.total).toBe(1);
    expect(r.body.data[0]).toMatchObject({
      lote: { numero: '2', quadra: 'A', loteamento: 'Sul' },
      cliente: { id: c.cliente.id, nome: c.cliente.nome },
      propostaAtual: { status: 'APROVADA', valor: '120000.00' },
    });
    expect(Object.keys(r.body.data[0].cliente).sort()).toEqual(['id', 'nome']);
    expect(Object.keys(r.body.data[0].propostaAtual).sort()).toEqual([
      'id',
      'status',
      'valor',
    ]);
    expect(JSON.stringify(r.body)).not.toContain(c.cliente.documento);
    await prisma.cliente.update({
      where: { id: c.cliente.id },
      data: { deletedAt: new Date() },
    });
    expect((await get().expect(200)).body.data[0].cliente.nome).toBeNull();
  });
  it('combina status, vendedor, loteamento e vencimento com extremos inclusivos', async () => {
    const data = c.reserva.dataVencimento.toISOString();
    const q =
      '?status=ATIVA,CANCELADA&vendedorId=' +
      c.usuarios.COMERCIAL.id +
      '&loteamentoId=' +
      c.loteamentos[1].id +
      '&vencimentoDe=' +
      encodeURIComponent(data) +
      '&vencimentoAte=' +
      encodeURIComponent(data);
    expect((await get('GESTOR', q).expect(200)).body.meta.total).toBe(1);
    expect(
      (await get('GESTOR', '?status=CONVERTIDA').expect(200)).body.meta.total,
    ).toBe(1);
  });
  it('ordena vencimento, pagina e mantém contagem além da última página', async () => {
    const r = await get('COMERCIAL', '/minhas').expect(200);
    const datas = r.body.data.map((x: { dataVencimento: string }) =>
      new Date(x.dataVencimento).getTime(),
    );
    expect(datas).toEqual([...datas].sort((a, b) => a - b));
    expect((await get('GESTOR', '?pageSize=2').expect(200)).body).toMatchObject(
      { meta: { total: 5, totalPages: 3 } },
    );
    expect((await get('GESTOR', '?page=99').expect(200)).body).toMatchObject({
      data: [],
      meta: { total: 5 },
    });
  });
  it('valida filtros, intervalo e nega Consulta ou ausência de login', async () => {
    for (const q of [
      '?status=X',
      '?vendedorId=x',
      '?vencimentoDe=ontem',
      '?vencimentoDe=2026-01-01',
      '?vencimentoDe=2026-02-01T00:00:00Z&vencimentoAte=2026-01-01T00:00:00Z',
    ])
      await get('GESTOR', q).expect(400);
    await get('CONSULTA').expect(403);
    await get('CONSULTA', '/minhas').expect(403);
    await request(app.getHttpServer()).get('/v1/reservas').expect(401);
  });
});
