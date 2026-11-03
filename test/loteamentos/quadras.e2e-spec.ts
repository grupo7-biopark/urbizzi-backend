import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import {
  criarUsuarios,
  PERFIS,
  type UsuariosTeste,
} from '../helpers/usuarios.js';

const ID_INEXISTENTE = '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10';

describe('Quadras (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;
  let loteamentoId: string;

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
    ({ id: loteamentoId } = await prisma.loteamento.create({
      data: { nome: 'Bela Vista' },
    }));
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const gestor = () => usuarios.GESTOR.token;

  async function criarQuadra(numero = 'A', id = loteamentoId) {
    const res = await http()
      .post(`/v1/loteamentos/${id}/quadras`)
      .auth(gestor(), { type: 'bearer' })
      .send({ numero })
      .expect(201);
    return res.body as { id: string; numero: string };
  }

  describe('POST /v1/loteamentos/:loteamentoId/quadras', () => {
    it('cria a quadra e registra auditoria', async () => {
      const res = await http()
        .post(`/v1/loteamentos/${loteamentoId}/quadras`)
        .auth(gestor(), { type: 'bearer' })
        .send({ numero: ' A ' })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        loteamentoId,
        numero: 'A',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: res.body.id },
      });
      expect(historico).toMatchObject({
        usuarioId: usuarios.GESTOR.id,
        entidadeTipo: 'Quadra',
        acao: 'CRIAR',
      });
    });

    it('retorna 400 DADOS_INVALIDOS com número vazio ou longo', async () => {
      for (const numero of ['  ', 'x'.repeat(21)]) {
        const res = await http()
          .post(`/v1/loteamentos/${loteamentoId}/quadras`)
          .auth(gestor(), { type: 'bearer' })
          .send({ numero })
          .expect(400);

        expect(res.body.code).toBe('DADOS_INVALIDOS');
      }
    });

    it('retorna 409 QUADRA_JA_EXISTE com número repetido no loteamento', async () => {
      await criarQuadra('A');

      const res = await http()
        .post(`/v1/loteamentos/${loteamentoId}/quadras`)
        .auth(gestor(), { type: 'bearer' })
        .send({ numero: 'a' })
        .expect(409);

      expect(res.body.code).toBe('QUADRA_JA_EXISTE');
    });

    it('permite o mesmo número em outro loteamento', async () => {
      const outro = await prisma.loteamento.create({
        data: { nome: 'Vista Alegre' },
      });
      await criarQuadra('A');

      await criarQuadra('A', outro.id);
    });

    it('retorna 404 LOTEAMENTO_NAO_ENCONTRADO', async () => {
      const res = await http()
        .post(`/v1/loteamentos/${ID_INEXISTENTE}/quadras`)
        .auth(gestor(), { type: 'bearer' })
        .send({ numero: 'A' })
        .expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });
  });

  describe('GET /v1/loteamentos/:loteamentoId/quadras', () => {
    it('lista só as quadras do loteamento, paginado e com busca', async () => {
      const outro = await prisma.loteamento.create({
        data: { nome: 'Vista Alegre' },
      });
      await criarQuadra('A');
      await criarQuadra('B');
      await criarQuadra('AB');
      await criarQuadra('Z', outro.id);

      const pagina = await http()
        .get(`/v1/loteamentos/${loteamentoId}/quadras?pageSize=2`)
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);
      const busca = await http()
        .get(`/v1/loteamentos/${loteamentoId}/quadras?q=a`)
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);

      expect(pagina.body.meta).toEqual({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
      expect(busca.body.data.map((q: { numero: string }) => q.numero)).toEqual([
        'AB',
        'A',
      ]);
    });

    it('retorna 404 para loteamento inexistente', async () => {
      const res = await http()
        .get(`/v1/loteamentos/${ID_INEXISTENTE}/quadras`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });
  });

  describe('GET /v1/quadras/:id', () => {
    it('detalha a quadra', async () => {
      const { id } = await criarQuadra();

      const res = await http()
        .get(`/v1/quadras/${id}`)
        .auth(usuarios.COMERCIAL.token, { type: 'bearer' })
        .expect(200);

      expect(res.body).toMatchObject({ id, loteamentoId, numero: 'A' });
    });

    it('retorna 404 QUADRA_NAO_ENCONTRADA', async () => {
      const res = await http()
        .get(`/v1/quadras/${ID_INEXISTENTE}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);

      expect(res.body.code).toBe('QUADRA_NAO_ENCONTRADA');
    });
  });

  describe('PATCH /v1/quadras/:id', () => {
    it('altera o número e audita', async () => {
      const { id } = await criarQuadra('A');

      const res = await http()
        .patch(`/v1/quadras/${id}`)
        .auth(usuarios.ADMINISTRADOR.token, { type: 'bearer' })
        .send({ numero: 'B' })
        .expect(200);

      expect(res.body.numero).toBe('B');
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: id, acao: 'ALTERAR' },
      });
      expect(historico.valorAnterior).toMatchObject({ numero: 'A' });
      expect(historico.valorNovo).toMatchObject({ numero: 'B' });
    });

    it('retorna 409 QUADRA_JA_EXISTE ao usar número de outra quadra', async () => {
      const { id } = await criarQuadra('A');
      await criarQuadra('B');

      const res = await http()
        .patch(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ numero: 'B' })
        .expect(409);

      expect(res.body.code).toBe('QUADRA_JA_EXISTE');
    });

    it('rejeita troca de loteamento pelo PATCH', async () => {
      const { id } = await criarQuadra('A');

      const res = await http()
        .patch(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ loteamentoId: ID_INEXISTENTE })
        .expect(400);

      expect(res.body.code).toBe('DADOS_INVALIDOS');
    });
  });

  describe('DELETE /v1/quadras/:id', () => {
    it('exclui logicamente e libera o número', async () => {
      const { id } = await criarQuadra('A');

      await http()
        .delete(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await http()
        .get(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);
      await criarQuadra('A');
      expect(
        await prisma.historicoAuditoria.count({
          where: { entidadeId: id, acao: 'EXCLUIR' },
        }),
      ).toBe(1);
    });

    it('retorna 409 QUADRA_COM_LOTES quando há lotes', async () => {
      const { id } = await criarQuadra('A');
      await prisma.lote.create({
        data: { quadraId: id, numero: '1', areaM2: '360' },
      });

      const res = await http()
        .delete(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(409);

      expect(res.body.code).toBe('QUADRA_COM_LOTES');
    });

    it('libera a exclusão do loteamento depois de excluir as quadras', async () => {
      const { id } = await criarQuadra('A');
      await http()
        .delete(`/v1/quadras/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await http()
        .delete(`/v1/loteamentos/${loteamentoId}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);
    });
  });

  describe('permissões', () => {
    it.each(PERFIS)('aplica a matriz de cadastros para %s', async (perfil) => {
      const { id } = await criarQuadra('Base');
      const token = usuarios[perfil].token;
      const gerencia = perfil === 'ADMINISTRADOR' || perfil === 'GESTOR';

      await http()
        .get(`/v1/loteamentos/${loteamentoId}/quadras`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await http()
        .get(`/v1/quadras/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await http()
        .post(`/v1/loteamentos/${loteamentoId}/quadras`)
        .auth(token, { type: 'bearer' })
        .send({ numero: perfil.slice(0, 5) })
        .expect(gerencia ? 201 : 403);
      await http()
        .patch(`/v1/quadras/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ numero: 'Nova' })
        .expect(gerencia ? 200 : 403);
      await http()
        .delete(`/v1/quadras/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(gerencia ? 204 : 403);
    });
  });
});
