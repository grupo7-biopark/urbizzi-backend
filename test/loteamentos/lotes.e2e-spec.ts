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

interface LoteResposta {
  id: string;
  numero: string;
  status: string;
}

describe('Lotes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;
  let loteamentoId: string;
  let quadraId: string;

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
    ({ id: quadraId } = await prisma.quadra.create({
      data: { loteamentoId, numero: 'A' },
    }));
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const gestor = () => usuarios.GESTOR.token;

  async function criarLote(
    dados: Record<string, unknown> = {},
  ): Promise<LoteResposta> {
    const res = await http()
      .post('/v1/lotes')
      .auth(gestor(), { type: 'bearer' })
      .send({ quadraId, numero: '1', areaM2: '360', ...dados })
      .expect(201);
    return res.body as LoteResposta;
  }

  describe('POST /v1/lotes', () => {
    it('cria DISPONIVEL com decimais em texto e registra auditoria', async () => {
      const res = await http()
        .post('/v1/lotes')
        .auth(gestor(), { type: 'bearer' })
        .send({
          quadraId,
          numero: ' 12 ',
          areaM2: 360.5,
          valor: '250000',
          exibirValorPublico: true,
          observacoes: 'Esquina',
        })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        loteamentoId,
        quadraId,
        numero: '12',
        areaM2: '360.50',
        valor: '250000.00',
        exibirValorPublico: true,
        status: 'DISPONIVEL',
        observacoes: 'Esquina',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: res.body.id },
      });
      expect(historico).toMatchObject({
        usuarioId: usuarios.GESTOR.id,
        entidadeTipo: 'Lote',
        acao: 'CRIAR',
      });
    });

    it('aplica os padrões dos campos opcionais', async () => {
      const lote = await criarLote();

      expect(lote).toMatchObject({
        valor: null,
        exibirValorPublico: false,
        observacoes: null,
      });
    });

    it('retorna 400 com área ou valor não positivos e com status no corpo', async () => {
      const res = await http()
        .post('/v1/lotes')
        .auth(gestor(), { type: 'bearer' })
        .send({
          quadraId,
          numero: '1',
          areaM2: '0',
          valor: -10,
          status: 'VENDIDO',
        })
        .expect(400);

      expect(res.body.code).toBe('DADOS_INVALIDOS');
      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['areaM2', 'valor', 'status']),
      );
    });

    it('retorna 400 sem quadra, número ou área', async () => {
      const res = await http()
        .post('/v1/lotes')
        .auth(gestor(), { type: 'bearer' })
        .send({})
        .expect(400);

      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(
        expect.arrayContaining(['quadraId', 'numero', 'areaM2']),
      );
    });

    it('retorna 409 LOTE_JA_EXISTE com número repetido na quadra', async () => {
      await criarLote({ numero: '1A' });

      const res = await http()
        .post('/v1/lotes')
        .auth(gestor(), { type: 'bearer' })
        .send({ quadraId, numero: '1a', areaM2: '300' })
        .expect(409);

      expect(res.body.code).toBe('LOTE_JA_EXISTE');
    });

    it('permite o mesmo número em outra quadra', async () => {
      const outra = await prisma.quadra.create({
        data: { loteamentoId, numero: 'B' },
      });
      await criarLote({ numero: '1' });

      await criarLote({ numero: '1', quadraId: outra.id });
    });

    it('retorna 404 QUADRA_NAO_ENCONTRADA', async () => {
      const res = await http()
        .post('/v1/lotes')
        .auth(gestor(), { type: 'bearer' })
        .send({ quadraId: ID_INEXISTENTE, numero: '1', areaM2: '300' })
        .expect(404);

      expect(res.body.code).toBe('QUADRA_NAO_ENCONTRADA');
    });
  });

  describe('GET /v1/lotes', () => {
    let outroLoteamentoId: string;

    beforeEach(async () => {
      const outro = await prisma.loteamento.create({
        data: { nome: 'Vista Alegre' },
      });
      outroLoteamentoId = outro.id;
      const quadraB = await prisma.quadra.create({
        data: { loteamentoId, numero: 'B' },
      });
      const quadraOutro = await prisma.quadra.create({
        data: { loteamentoId: outro.id, numero: 'A' },
      });
      await criarLote({ numero: '1' });
      const reservado = await criarLote({ numero: '2' });
      await criarLote({ numero: '10', quadraId: quadraB.id });
      await criarLote({ numero: '1', quadraId: quadraOutro.id });
      await prisma.lote.update({
        where: { id: reservado.id },
        data: { status: 'RESERVADO' },
      });
    });

    async function numeros(query: string): Promise<string[]> {
      const res = await http()
        .get(`/v1/lotes?${query}`)
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);
      return res.body.data
        .map((l: LoteResposta) => l.numero)
        .sort((a: string, b: string) => a.localeCompare(b));
    }

    it('lista todos paginado', async () => {
      const res = await http()
        .get('/v1/lotes?page=2&pageSize=3')
        .auth(usuarios.CONSULTA.token, { type: 'bearer' })
        .expect(200);

      expect(res.body.meta).toEqual({
        page: 2,
        pageSize: 3,
        total: 4,
        totalPages: 2,
      });
      expect(res.body.data).toHaveLength(1);
    });

    it('filtra por loteamento, quadra, status e número', async () => {
      expect(await numeros(`loteamentoId=${loteamentoId}`)).toEqual([
        '1',
        '10',
        '2',
      ]);
      expect(await numeros(`loteamentoId=${outroLoteamentoId}`)).toEqual(['1']);
      expect(await numeros(`quadraId=${quadraId}`)).toEqual(['1', '2']);
      expect(await numeros('status=RESERVADO')).toEqual(['2']);
      expect(await numeros('status=DISPONIVEL,RESERVADO')).toHaveLength(4);
      expect(await numeros('q=1')).toEqual(['1', '1', '10']);
    });

    it('combina os filtros', async () => {
      expect(
        await numeros(`loteamentoId=${loteamentoId}&status=DISPONIVEL&q=1`),
      ).toEqual(['1', '10']);
      expect(await numeros(`quadraId=${quadraId}&status=VENDIDO`)).toEqual([]);
    });

    it('retorna 400 com status ou id inválido', async () => {
      for (const query of ['status=PERDIDO', 'quadraId=abc']) {
        const res = await http()
          .get(`/v1/lotes?${query}`)
          .auth(gestor(), { type: 'bearer' })
          .expect(400);

        expect(res.body.code).toBe('DADOS_INVALIDOS');
      }
    });
  });

  describe('GET /v1/lotes/:id', () => {
    it('detalha o lote', async () => {
      const { id } = await criarLote({ valor: '1000.5' });

      const res = await http()
        .get(`/v1/lotes/${id}`)
        .auth(usuarios.COMERCIAL.token, { type: 'bearer' })
        .expect(200);

      expect(res.body).toMatchObject({ id, loteamentoId, valor: '1000.50' });
    });

    it('retorna 404 LOTE_NAO_ENCONTRADO', async () => {
      const res = await http()
        .get(`/v1/lotes/${ID_INEXISTENTE}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);

      expect(res.body.code).toBe('LOTE_NAO_ENCONTRADO');
    });
  });

  describe('PATCH /v1/lotes/:id', () => {
    it('atualiza e audita a mudança de valor', async () => {
      const { id } = await criarLote({ valor: '250000' });

      const res = await http()
        .patch(`/v1/lotes/${id}`)
        .auth(usuarios.ADMINISTRADOR.token, { type: 'bearer' })
        .send({ valor: '260000', exibirValorPublico: true })
        .expect(200);

      expect(res.body).toMatchObject({
        valor: '260000.00',
        exibirValorPublico: true,
      });
      const historico = await prisma.historicoAuditoria.findFirstOrThrow({
        where: { entidadeId: id, acao: 'ALTERAR' },
      });
      expect(historico.valorAnterior).toMatchObject({ valor: '250000.00' });
      expect(historico.valorNovo).toMatchObject({ valor: '260000.00' });
    });

    it('limpa o valor com null', async () => {
      const { id } = await criarLote({ valor: '250000' });

      const res = await http()
        .patch(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ valor: null })
        .expect(200);

      expect(res.body.valor).toBeNull();
    });

    it('rejeita alteração de status e de quadra pelo CRUD', async () => {
      const { id } = await criarLote();

      for (const corpo of [{ status: 'VENDIDO' }, { quadraId }]) {
        const res = await http()
          .patch(`/v1/lotes/${id}`)
          .auth(gestor(), { type: 'bearer' })
          .send(corpo)
          .expect(400);

        expect(res.body.code).toBe('DADOS_INVALIDOS');
      }
      const lote = await prisma.lote.findUniqueOrThrow({ where: { id } });
      expect(lote.status).toBe('DISPONIVEL');
    });

    it('retorna 409 LOTE_JA_EXISTE ao usar número de outro lote da quadra', async () => {
      const { id } = await criarLote({ numero: '1' });
      await criarLote({ numero: '2' });

      const res = await http()
        .patch(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ numero: '2' })
        .expect(409);

      expect(res.body.code).toBe('LOTE_JA_EXISTE');
    });

    it('retorna 400 com área negativa', async () => {
      const { id } = await criarLote();

      await http()
        .patch(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .send({ areaM2: '-1' })
        .expect(400);
    });
  });

  describe('DELETE /v1/lotes/:id', () => {
    it('exclui lote disponível, libera o número e audita', async () => {
      const { id } = await criarLote({ numero: '1' });

      await http()
        .delete(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await http()
        .get(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(404);
      await criarLote({ numero: '1' });
      expect(
        await prisma.historicoAuditoria.count({
          where: { entidadeId: id, acao: 'EXCLUIR' },
        }),
      ).toBe(1);
    });

    it('retorna 409 LOTE_NAO_DISPONIVEL para lote reservado', async () => {
      const { id } = await criarLote();
      await prisma.lote.update({
        where: { id },
        data: { status: 'RESERVADO', teveReserva: true },
      });

      const res = await http()
        .delete(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(409);

      expect(res.body.code).toBe('LOTE_NAO_DISPONIVEL');
    });

    it('retorna 409 LOTE_COM_RESERVAS para lote disponível com histórico', async () => {
      const { id } = await criarLote();
      await prisma.lote.update({ where: { id }, data: { teveReserva: true } });

      const res = await http()
        .delete(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(409);

      expect(res.body.code).toBe('LOTE_COM_RESERVAS');
    });

    it('libera a exclusão da quadra depois de excluir os lotes', async () => {
      const { id } = await criarLote();
      await http()
        .delete(`/v1/lotes/${id}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);

      await http()
        .delete(`/v1/quadras/${quadraId}`)
        .auth(gestor(), { type: 'bearer' })
        .expect(204);
    });
  });

  describe('permissões', () => {
    it.each(PERFIS)('aplica a matriz de cadastros para %s', async (perfil) => {
      const { id } = await criarLote({ numero: 'Base' });
      const token = usuarios[perfil].token;
      const gerencia = perfil === 'ADMINISTRADOR' || perfil === 'GESTOR';

      await http().get('/v1/lotes').auth(token, { type: 'bearer' }).expect(200);
      await http()
        .get(`/v1/lotes/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await http()
        .post('/v1/lotes')
        .auth(token, { type: 'bearer' })
        .send({ quadraId, numero: perfil.slice(0, 5), areaM2: '300' })
        .expect(gerencia ? 201 : 403);
      await http()
        .patch(`/v1/lotes/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ observacoes: perfil })
        .expect(gerencia ? 200 : 403);
      await http()
        .delete(`/v1/lotes/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(gerencia ? 204 : 403);
    });
  });
});
