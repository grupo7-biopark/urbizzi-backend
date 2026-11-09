import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarAppTeste, criarUsuarioTeste } from '../helpers/feature-test.js';
import { criarCenarioMapa } from '../helpers/mapa.js';

describe('Detalhe do lote (e2e)', () => {
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
  afterAll(async () => {
    await app?.close();
  });

  const loteUrl = () => '/v1/lotes/' + c.reserva.loteId;
  const detalhe = (
    perfil: keyof typeof c.usuarios = 'GESTOR',
    url = loteUrl(),
  ) =>
    request(app.getHttpServer())
      .get(url + '/detalhe')
      .auth(c.usuarios[perfil].token, { type: 'bearer' });

  it('retorna detalhe vazio de lote disponível e protege lotes ausentes ou excluídos', async () => {
    const url = '/v1/lotes/' + c.lotes[0].id;
    const r = await detalhe('GESTOR', url)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(r.body).toMatchObject({
      lote: { id: c.lotes[0].id, status: 'DISPONIVEL', areaM2: '100.25' },
      quadra: { id: c.quadras[0].id, numero: 'A' },
      loteamento: { id: c.loteamentos[0].id, nome: 'Norte' },
      reserva: null,
      propostas: [],
      historico: [],
    });
    await detalhe('GESTOR', '/v1/lotes/' + randomUUID()).expect(404);
    await detalhe('GESTOR', '/v1/lotes/invalido').expect(400);
    await request(app.getHttpServer())
      .get(url + '/detalhe')
      .expect(401);
    await prisma.lote.update({
      where: { id: c.lotes[0].id },
      data: { deletedAt: new Date() },
    });
    await detalhe('GESTOR', url).expect(404);
  });

  it('limita dados pessoais e histórico conforme o perfil e a propriedade', async () => {
    await app.get(AuditoriaService).registrar({
      usuarioId: c.usuarios.COMERCIAL.id,
      entidadeTipo: 'Reserva',
      entidadeId: c.reserva.id,
      acao: 'CRIAR',
      motivo: 'Texto livre de auditoria',
    });
    for (const perfil of ['GESTOR', 'COMERCIAL'] as const) {
      const r = await detalhe(perfil).expect(200);
      expect(r.body).toMatchObject({
        lote: { status: 'RESERVADO' },
        reserva: {
          status: 'ATIVA',
          cliente: { id: c.cliente.id, nome: c.cliente.nome },
          vendedor: { id: c.usuarios.COMERCIAL.id },
        },
        propostas: [{ status: 'APROVADA', valor: '120000.00' }],
        historico: [{ entidadeTipo: 'Reserva', acao: 'CRIAR' }],
      });
      const resposta = JSON.stringify(r.body);
      expect(resposta).not.toContain(c.cliente.documento);
      expect(resposta).not.toContain('Condição confidencial');
      expect(resposta).not.toContain('Texto livre de auditoria');
    }

    const outro = await criarUsuarioTeste(app, 'COMERCIAL');
    const consulta = await detalhe('CONSULTA').expect(200);
    const outroComercial = await request(app.getHttpServer())
      .get(loteUrl() + '/detalhe')
      .auth(outro.token, { type: 'bearer' })
      .expect(200);
    for (const r of [consulta, outroComercial]) {
      expect(r.body).toMatchObject({
        lote: { status: 'RESERVADO' },
        reserva: null,
        propostas: [],
        historico: [],
      });
      expect(JSON.stringify(r.body)).not.toContain(c.cliente.nome);
    }
  });

  it('omite o nome de cliente excluído, preservando a referência da reserva', async () => {
    await prisma.cliente.update({
      where: { id: c.cliente.id },
      data: { deletedAt: new Date() },
    });
    const r = await detalhe().expect(200);
    expect(r.body.reserva.cliente).toEqual({ id: c.cliente.id, nome: null });
  });

  it('mostra a reserva convertida, a proposta aprovada e o evento de venda', async () => {
    await prisma.lote.update({
      where: { id: c.reserva.loteId },
      data: { status: 'VENDIDO' },
    });
    await prisma.reserva.update({
      where: { id: c.reserva.id },
      data: { status: 'CONVERTIDA' },
    });
    await app.get(AuditoriaService).registrar({
      usuarioId: c.usuarios.GESTOR.id,
      entidadeTipo: 'Lote',
      entidadeId: c.reserva.loteId,
      acao: 'VENDER',
    });
    const r = await detalhe().expect(200);
    expect(r.body).toMatchObject({
      lote: { status: 'VENDIDO' },
      reserva: { id: c.reserva.id, status: 'CONVERTIDA' },
      propostas: [{ status: 'APROVADA' }],
      historico: [{ entidadeTipo: 'Lote', acao: 'VENDER' }],
    });
  });

  it('documenta a rota e o status no Swagger', () => {
    const { paths } = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(paths['/v1/lotes/{id}/detalhe']?.get?.responses).toHaveProperty(
      '200',
    );
  });
});
