import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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

describe('Loteamentos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;

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
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const gestor = () => usuarios.GESTOR.token;

  async function criarLoteamento(nome = 'Bela Vista') {
    const res = await http()
      .post('/v1/loteamentos')
      .auth(gestor(), { type: 'bearer' })
      .send({ nome })
      .expect(201);
    return res.body as { id: string; nome: string };
  }

  describe('POST /v1/loteamentos', () => {
    it('cria, normaliza o texto e registra auditoria', async () => {
      const res = await http()
        .post('/v1/loteamentos')
        .auth(gestor(), { type: 'bearer' })
        .send({
          nome: '  Residencial Bela Vista ',
          descricao: '   ',
          localizacao: 'Toledo - PR',
        })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        nome: 'Residencial Bela Vista',
        descricao: null,
        localizacao: 'Toledo - PR',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: res.body.id },
      });
      expect(historico).toMatchObject({
        usuarioId: usuarios.GESTOR.id,
        entidadeTipo: 'Loteamento',
        acao: 'CRIAR',
      });
    });

    it('retorna 400 DADOS_INVALIDOS com nome vazio, longo ou campo extra', async () => {
      const res = await http()
        .post('/v1/loteamentos')
        .auth(gestor(), { type: 'bearer' })
        .send({ nome: '   ', localizacao: 'x'.repeat(256), status: 'X' })
        .expect(400);

      expect(res.body.code).toBe('DADOS_INVALIDOS');
      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['nome', 'localizacao', 'status']),
      );
    });

    it('retorna 409 LOTEAMENTO_JA_EXISTE com nome repetido, sem diferenciar maiúsculas', async () => {
      await criarLoteamento('Bela Vista');

      const res = await http()
        .post('/v1/loteamentos')
        .auth(gestor(), { type: 'bearer' })
        .send({ nome: 'BELA VISTA' })
        .expect(409);

      expect(res.body.code).toBe('LOTEAMENTO_JA_EXISTE');
    });

    it('permite reutilizar o nome de um loteamento excluído', async () => {
      const { id } = await criarLoteamento('Bela Vista');
      await http()
        .delete(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await criarLoteamento('Bela Vista');
    });
  });

  describe('GET /v1/loteamentos', () => {
    it('lista paginado e filtra por nome', async () => {
      await criarLoteamento('Bela Vista');
      await criarLoteamento('Jardim das Flores');
      await criarLoteamento('Vista Alegre');

      const pagina = await http()
        .get('/v1/loteamentos?page=2&pageSize=2')
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);
      const busca = await http()
        .get('/v1/loteamentos?q=vista')
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);

      expect(pagina.body.meta).toEqual({
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
      expect(pagina.body.data).toHaveLength(1);
      expect(busca.body.data.map((l: { nome: string }) => l.nome)).toEqual([
        'Vista Alegre',
        'Bela Vista',
      ]);
    });

    it('retorna 400 com filtro desconhecido', async () => {
      const res = await http()
        .get('/v1/loteamentos?uf=PR')
        .auth(gestor(), { type: 'bearer' })
        .expect(400);

      expect(res.body.code).toBe('DADOS_INVALIDOS');
    });
  });

  describe('GET /v1/loteamentos/:id', () => {
    it('detalha o loteamento', async () => {
      const { id } = await criarLoteamento();

      const res = await http()
        .get(`/v1/loteamentos/${id}`)
        .auth(usuarios.COMERCIAL.token, { type: 'bearer' })
        .expect(200);

      expect(res.body).toMatchObject({ id, nome: 'Bela Vista' });
    });

    it('retorna 404 LOTEAMENTO_NAO_ENCONTRADO', async () => {
      const res = await http()
        .get(`/v1/loteamentos/${ID_INEXISTENTE}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });

    it('retorna 400 com id inválido', async () => {
      await http()
        .get('/v1/loteamentos/abc')
        .auth(gestor(), { type: 'bearer' })
        .expect(400);
    });
  });

  describe('PATCH /v1/loteamentos/:id', () => {
    it('atualiza parcialmente e audita valores anterior e novo', async () => {
      const { id } = await criarLoteamento();

      const res = await http()
        .patch(`/v1/loteamentos/${id}`)
        .auth(usuarios.ADMINISTRADOR.token, { type: 'bearer' })
        .send({ descricao: 'Nova descrição' })
        .expect(200);

      expect(res.body).toMatchObject({
        nome: 'Bela Vista',
        descricao: 'Nova descrição',
      });
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: id, acao: 'ALTERAR' },
      });
      expect(historico.valorAnterior).toMatchObject({ descricao: null });
      expect(historico.valorNovo).toMatchObject({
        descricao: 'Nova descrição',
      });
    });

    it('permite manter o próprio nome e rejeita nome de outro loteamento', async () => {
      const { id } = await criarLoteamento('Bela Vista');
      await criarLoteamento('Vista Alegre');

      await http()
        .patch(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ nome: 'Bela Vista' })
        .expect(200);
      const res = await http()
        .patch(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ nome: 'vista alegre' })
        .expect(409);

      expect(res.body.code).toBe('LOTEAMENTO_JA_EXISTE');
    });

    it('retorna 404 para loteamento inexistente', async () => {
      const res = await http()
        .patch(`/v1/loteamentos/${ID_INEXISTENTE}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ nome: 'Outro' })
        .expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });
  });

  describe('DELETE /v1/loteamentos/:id', () => {
    it('exclui logicamente e o loteamento deixa de aparecer', async () => {
      const { id } = await criarLoteamento();

      await http()
        .delete(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await http()
        .get(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);
      const registro = await prisma.loteamento.findUniqueOrThrow({
        where: { id },
      });
      expect(registro.deletedAt).not.toBeNull();
      expect(
        await prisma.historicoAuditoria.count({
          where: { entidadeId: id, acao: 'EXCLUIR' },
        }),
      ).toBe(1);
    });

    it('retorna 409 LOTEAMENTO_COM_QUADRAS quando há quadras', async () => {
      const { id } = await criarLoteamento();
      await prisma.quadra.create({ data: { loteamentoId: id, numero: 'A' } });

      const res = await http()
        .delete(`/v1/loteamentos/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(409);

      expect(res.body.code).toBe('LOTEAMENTO_COM_QUADRAS');
    });

    it('retorna 404 para loteamento inexistente', async () => {
      const res = await http()
        .delete(`/v1/loteamentos/${ID_INEXISTENTE}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);

      expect(res.body.code).toBe('LOTEAMENTO_NAO_ENCONTRADO');
    });
  });

  describe('permissões', () => {
    it.each(PERFIS)('aplica a matriz de cadastros para %s', async (perfil) => {
      const { id } = await criarLoteamento('Base');
      const token = usuarios[perfil].token;
      const gerencia = perfil === 'ADMINISTRADOR' || perfil === 'GESTOR';

      await http()
        .get('/v1/loteamentos')
        .auth(token, { type: 'bearer' })
        .expect(200);
      await http()
        .get(`/v1/loteamentos/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await http()
        .post('/v1/loteamentos')
        .auth(token, { type: 'bearer' })
        .send({ nome: `Novo ${perfil}` })
        .expect(gerencia ? 201 : 403);
      await http()
        .patch(`/v1/loteamentos/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ descricao: perfil })
        .expect(gerencia ? 200 : 403);
      await http()
        .delete(`/v1/loteamentos/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(gerencia ? 204 : 403);
    });

    it('retorna 401 sem token', async () => {
      await http().get('/v1/loteamentos').expect(401);
    });
  });
});
