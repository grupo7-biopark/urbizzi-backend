import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { GEOCODIFICADOR } from '../../src/modules/loteamentos/domain/repositories/geocodificador.interface.js';
import { limparBanco } from '../helpers/database.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';
const limite = [
    [0, 0],
    [0, 4],
    [4, 4],
    [4, 0],
  ],
  a = [
    [0, 0],
    [0, 2],
    [2, 2],
    [2, 0],
  ],
  b = [
    [0, 2],
    [0, 4],
    [2, 4],
    [2, 2],
  ];
describe('Geografia (e2e)', () => {
  let app: INestApplication,
    prisma: PrismaService,
    usuarios: UsuariosTeste,
    parent: string,
    quadra: string;
  const http = () => request(app.getHttpServer());
  const call = (method: 'post' | 'patch' | 'put' | 'get', path: string) =>
    http()[method](path).auth(usuarios.GESTOR.token, { type: 'bearer' });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GEOCODIFICADOR)
      .useValue({
        search: vi
          .fn()
          .mockResolvedValue([
            { nome: 'Toledo', latitude: -24.72, longitude: -53.74 },
          ]),
      })
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
    parent = (
      await call('post', '/v1/geografia/loteamentos')
        .send({ cadastro: { nome: 'Mapa teste' }, vertices: limite })
        .expect(201)
    ).body.id;
    quadra = (
      await call('post', `/v1/geografia/loteamentos/${parent}/quadras`)
        .send({ cadastro: { numero: 'A' }, vertices: limite })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await app?.close();
  });
  const lote = (numero: string, vertices: number[][]) =>
    call('post', '/v1/geografia/lotes').send({
      cadastro: { quadraId: quadra, numero, areaM2: '360.00' },
      vertices,
    });
  it('demarca quadras distintas com divisa compartilhada e expõe identificação no mapa', async () => {
    await call('put', `/v1/geografia/areas/quadras/${quadra}`)
      .send({ vertices: a })
      .expect(200);
    const other = await call(
      'post',
      `/v1/geografia/loteamentos/${parent}/quadras`,
    )
      .send({ cadastro: { numero: 'B' }, vertices: b })
      .expect(201);
    const areas = await call(
      'get',
      `/v1/geografia/areas?loteamentoId=${parent}`,
    );
    expect(areas.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: other.body.id,
          tipo: 'QUADRA',
          nome: 'Quadra B',
          quadraId: other.body.id,
          vertices: b,
        }),
      ]),
    );
    const overlap = await call(
      'post',
      `/v1/geografia/loteamentos/${parent}/quadras`,
    )
      .send({ cadastro: { numero: 'C' }, vertices: a })
      .expect(422);
    expect(overlap.body.code).toBe('QUADRAS_SOBREPOSTAS');
    expect(await prisma.quadra.count()).toBe(2);
  });
  it('recusa quadra fora do loteamento sem criar cadastro parcial', async () => {
    const result = await call(
      'post',
      `/v1/geografia/loteamentos/${parent}/quadras`,
    )
      .send({
        cadastro: { numero: 'FORA' },
        vertices: [
          [3, 3],
          [3, 5],
          [5, 5],
          [5, 3],
        ],
      })
      .expect(422);
    expect(result.body.code).toBe('QUADRA_FORA_DO_LOTEAMENTO');
    expect(await prisma.quadra.count()).toBe(1);
  });
  it('exige quadra demarcada e impede lote fora dela, mesmo dentro do loteamento', async () => {
    await call('put', `/v1/geografia/areas/quadras/${quadra}`)
      .send({ vertices: null })
      .expect(200);
    expect((await lote('SEM', a).expect(422)).body.code).toBe(
      'QUADRA_SEM_DEMARCACAO',
    );
    await call('put', `/v1/geografia/areas/quadras/${quadra}`)
      .send({ vertices: a })
      .expect(200);
    expect((await lote('FORA', b).expect(422)).body.code).toBe(
      'LOTE_FORA_DA_QUADRA',
    );
    const first = await lote('DENTRO', a).expect(201);
    expect(
      (await call('get', `/v1/geografia/areas/${first.body.id}`)).body.area
        .quadraId,
    ).toBe(quadra);
    await call('patch', `/v1/geografia/quadras/${quadra}`)
      .send({
        cadastro: { numero: 'NAO-SALVAR' },
        vertices: [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ],
      })
      .expect(422);
    expect(
      (await prisma.quadra.findUniqueOrThrow({ where: { id: quadra } })).numero,
    ).toBe('A');
    expect(
      (
        await call('put', `/v1/geografia/areas/quadras/${quadra}`)
          .send({ vertices: null })
          .expect(422)
      ).body.code,
    ).toBe('QUADRA_COM_DEMARCACOES');
  });
  it('serializa limites de quadras concorrentes e aplica autorização', async () => {
    await call('put', `/v1/geografia/areas/quadras/${quadra}`)
      .send({ vertices: null })
      .expect(200);
    const q2 = (
      await call('post', `/v1/loteamentos/${parent}/quadras`).send({
        numero: 'B',
      })
    ).body.id;
    const results = await Promise.all([
      call('put', `/v1/geografia/areas/quadras/${quadra}`).send({
        vertices: a,
      }),
      call('put', `/v1/geografia/areas/quadras/${q2}`).send({ vertices: a }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    await http()
      .put(`/v1/geografia/areas/quadras/${quadra}`)
      .auth(usuarios.CONSULTA.token, { type: 'bearer' })
      .send({ vertices: null })
      .expect(403);
  });
  it('persiste contornos e aceita lotes com divisa compartilhada', async () => {
    const first = await lote('1', a).expect(201);
    await lote('2', b).expect(201);
    const read = await call(
      'get',
      `/v1/geografia/areas/${first.body.id}`,
    ).expect(200);
    expect(read.body.area.vertices).toEqual(a);
    const list = await call(
      'get',
      `/v1/geografia/areas?pageSize=2&loteamentoId=${parent}`,
    ).expect(200);
    expect(list.body.meta).toMatchObject({ total: 4, totalPages: 2 });
    expect(list.body.data).toHaveLength(2);
  });
  it('grava lote com 500 pontos e recusa 501 sem alterar o contorno', async () => {
    const vertices = Array.from({ length: 500 }, (_, i) => [
      1 + 0.5 * Math.cos((i * 2 * Math.PI) / 500),
      1 + 0.5 * Math.sin((i * 2 * Math.PI) / 500),
    ]);
    const saved = await lote('DETALHADO', vertices).expect(201);
    expect(
      (await call('get', `/v1/geografia/areas/${saved.body.id}`)).body.area
        .vertices,
    ).toEqual(vertices);
    await call('put', `/v1/geografia/areas/lotes/${saved.body.id}`)
      .send({ vertices: [...vertices, [1, 1]] })
      .expect(400);
    expect(
      (await call('get', `/v1/geografia/areas/${saved.body.id}`)).body.area
        .vertices,
    ).toHaveLength(500);
  });
  it('desfaz cadastro e auditoria se o lote estiver fora ou sobreposto', async () => {
    await lote('1', a).expect(201);
    expect((await lote('2', a).expect(422)).body.code).toBe(
      'LOTES_SOBREPOSTOS',
    );
    expect(
      (
        await lote('3', [
          [3, 3],
          [3, 5],
          [5, 5],
          [5, 3],
        ]).expect(422)
      ).body.code,
    ).toBe('LOTE_FORA_DO_LOTEAMENTO');
    expect(await prisma.lote.count()).toBe(1);
    expect(
      await prisma.historicoAuditoria.count({
        where: { entidadeTipo: 'Lote', acao: 'CRIAR' },
      }),
    ).toBe(1);
  });
  it('edita lote e contorno juntos e desfaz metadados quando o novo limite é inválido', async () => {
    const first = await lote('1', a).expect(201);
    await call('patch', `/v1/geografia/lotes/${first.body.id}`)
      .send({ cadastro: { numero: 'EDITADO' }, vertices: b })
      .expect(200);
    expect(
      (await call('get', `/v1/geografia/areas/${first.body.id}`)).body.area
        .vertices,
    ).toEqual(b);
    await call('patch', `/v1/geografia/lotes/${first.body.id}`)
      .send({
        cadastro: { numero: 'NAO-SALVAR' },
        vertices: [
          [3, 3],
          [3, 5],
          [5, 5],
          [5, 3],
        ],
      })
      .expect(422);
    expect(
      (await prisma.lote.findUniqueOrThrow({ where: { id: first.body.id } }))
        .numero,
    ).toBe('EDITADO');
  });
  it('serializa demarcações concorrentes na mesma quadra', async () => {
    const results = await Promise.all([
      lote('1', a),
      call('post', '/v1/geografia/lotes').send({
        cadastro: { quadraId: quadra, numero: '2', areaM2: '100.00' },
        vertices: a,
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(await prisma.lote.count()).toBe(1);
  });
  it('não permite encolher ou remover o loteamento deixando lotes fora', async () => {
    await lote('1', a).expect(201);
    await call('patch', `/v1/geografia/loteamentos/${parent}`)
      .send({ cadastro: { nome: 'Não persistir' }, vertices: b })
      .expect(422);
    expect(
      (await prisma.loteamento.findUniqueOrThrow({ where: { id: parent } }))
        .nome,
    ).toBe('Mapa teste');
    expect(
      (
        await call('put', `/v1/geografia/areas/loteamentos/${parent}`)
          .send({ vertices: null })
          .expect(422)
      ).body.code,
    ).toBe('LOTEAMENTO_COM_DEMARCACOES');
  });
  it('exige parent demarcado, valida formato e permite limpar lote', async () => {
    const first = await lote('1', a).expect(201);
    await call('put', `/v1/geografia/areas/lotes/${first.body.id}`)
      .send({ vertices: null })
      .expect(200);
    await call('put', `/v1/geografia/areas/quadras/${quadra}`)
      .send({ vertices: null })
      .expect(200);
    await call('put', `/v1/geografia/areas/loteamentos/${parent}`)
      .send({ vertices: null })
      .expect(200);
    expect((await lote('2', b).expect(422)).body.code).toBe(
      'LOTEAMENTO_SEM_DEMARCACAO',
    );
    await lote('3', [
      [0, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ]).expect(400);
    await call('put', `/v1/geografia/areas/loteamentos/${parent}`)
      .send({})
      .expect(400);
    expect(
      (await call('get', `/v1/geografia/areas/${parent}`).expect(200)).body
        .area,
    ).toBeNull();
  });
  it('protege escrita por perfil e não retorna áreas excluídas', async () => {
    await http()
      .put(`/v1/geografia/areas/loteamentos/${parent}`)
      .auth(usuarios.CONSULTA.token, { type: 'bearer' })
      .send({ vertices: limite })
      .expect(403);
    await http().get('/v1/geografia/areas').expect(401);
    await prisma.loteamento.update({
      where: { id: parent },
      data: { deletedAt: new Date() },
    });
    expect(
      (await call('get', '/v1/geografia/areas').expect(200)).body.meta.total,
    ).toBe(0);
    await call('put', `/v1/geografia/areas/loteamentos/${parent}`)
      .send({ vertices: limite })
      .expect(404);
  });
  it('busca manualmente com resposta paginada sem consultar serviço externo no teste', async () => {
    const result = await call('get', '/v1/geografia/busca?q=Toledo').expect(
      200,
    );
    expect(result.body.data[0].nome).toBe('Toledo');
    await call('get', '/v1/geografia/busca?q=a').expect(400);
  });
});
