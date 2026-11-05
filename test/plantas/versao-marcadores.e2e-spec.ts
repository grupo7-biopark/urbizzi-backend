import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { STORAGE } from '../../src/shared/application/storage/storage.interface.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { ProcessamentoPlantaService } from '../../src/modules/plantas/application/services/processamento-planta.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';
import { png } from '../helpers/plantas.js';

describe('Versões da planta com marcadores', () => {
  let app: INestApplication, prisma: PrismaService, usuarios: UsuariosTeste;
  const arquivos = new Map<string, Buffer>();
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE)
      .useValue({
        async upload({
          bucket,
          key,
          body,
        }: {
          bucket: string;
          key: string;
          body: Readable;
        }) {
          arquivos.set(bucket + '/' + key, await buffer(body));
        },
        async download(bucket: string, key: string) {
          return Readable.from([arquivos.get(bucket + '/' + key)!]);
        },
        async delete(bucket: string, key: string) {
          arquivos.delete(bucket + '/' + key);
        },
      })
      .compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  beforeEach(async () => {
    arquivos.clear();
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });
  afterAll(async () => {
    arquivos.clear();
    await app?.close();
  });
  const api = () => request(app.getHttpServer());
  const gestor = () => usuarios.GESTOR.token;
  async function enviar(largura: number, altura: number, copiar?: string) {
    const req = api()
      .post('/v1/plantas')
      .auth(gestor(), { type: 'bearer' })
      .field('nome', 'Masterplan');
    if (copiar !== undefined) req.field('copiarMarcadores', copiar);
    return req.attach('arquivos', await png(largura, altura), 'planta.png');
  }
  const listar = async (id: string) =>
    (
      await api()
        .get('/v1/plantas/' + id + '/marcadores')
        .auth(gestor(), { type: 'bearer' })
        .expect(200)
    ).body.data;
  async function ativar(id: string) {
    await app.get(ProcessamentoPlantaService).processarProxima();
    await api()
      .post('/v1/plantas/' + id + '/ativar')
      .auth(gestor(), { type: 'bearer' })
      .expect(200);
  }
  async function origem() {
    const p = await enviar(100, 50);
    expect(p.status).toBe(201);
    await ativar(p.body.id);
    const e = await prisma.loteamento.create({ data: { nome: 'Original' } });
    const q = await prisma.quadra.create({
      data: { numero: '1', loteamentoId: e.id },
    });
    for (const numero of ['1', '2']) {
      const lote = await prisma.lote.create({
        data: { numero, quadraId: q.id, areaM2: 100 },
      });
      await api()
        .post('/v1/plantas/' + p.body.id + '/marcadores')
        .auth(gestor(), { type: 'bearer' })
        .send({ loteId: lote.id, x: Number(numero) / 3, y: 0.75 })
        .expect(201);
    }
    return p.body.id as string;
  }
  it.each([
    [200, 100, false],
    [100, 100, true],
  ] as const)(
    'preserva coordenadas e histórico ao ativar %s x %s',
    async (w, h, revisar) => {
      const anterior = await origem();
      const originais = await listar(anterior);
      const nova = await enviar(w, h, 'true');
      expect(nova.status).toBe(201);
      const copias = await listar(nova.body.id);
      expect(copias).toHaveLength(2);
      for (const antigo of originais) {
        const copia = copias.find(
          (c: { loteId: string }) => c.loteId === antigo.loteId,
        );
        expect(copia).toMatchObject({ x: antigo.x, y: antigo.y, revisar });
        expect(copia.id).not.toBe(antigo.id);
      }
      await ativar(nova.body.id);
      expect(
        (
          await api()
            .get('/v1/plantas/ativa')
            .auth(gestor(), { type: 'bearer' })
            .expect(200)
        ).body.id,
      ).toBe(nova.body.id);
      expect(
        (
          await api()
            .get('/v1/plantas/' + anterior)
            .auth(gestor(), { type: 'bearer' })
            .expect(200)
        ).body.ativa,
      ).toBe(false);
      expect(await listar(anterior)).toEqual(originais);
      if (revisar) {
        const url =
          '/v1/plantas/' +
          nova.body.id +
          '/marcadores/' +
          copias[0].id +
          '/revisar';
        await api()
          .post(url)
          .auth(usuarios.COMERCIAL.token, { type: 'bearer' })
          .expect(403);
        await api()
          .post(url.replace(nova.body.id, anterior))
          .auth(gestor(), { type: 'bearer' })
          .expect(404);
        for (let i = 0; i < 2; i++)
          expect(
            (
              await api()
                .post(url)
                .auth(gestor(), { type: 'bearer' })
                .expect(200)
            ).body.revisar,
          ).toBe(false);
        expect(
          await prisma.historicoAuditoria.count({
            where: { entidadeId: copias[0].id, acao: 'REVISAR' },
          }),
        ).toBe(1);
        const terceira = await enviar(50, 50, 'true');
        expect(terceira.status).toBe(201);
        expect(
          (await listar(terceira.body.id)).filter(
            (c: { revisar: boolean }) => c.revisar,
          ),
        ).toHaveLength(1);
      }
    },
  );
  it('preserva o upload sem cópia e rejeita cópia sem origem ativa', async () => {
    expect((await enviar(60, 30, 'true')).status).toBe(404);
    expect(await prisma.planta.count()).toBe(0);
    expect(arquivos.size).toBe(0);
    await origem();
    for (const valor of [undefined, 'false']) {
      const p = await enviar(60, 30, valor);
      expect(p.status).toBe(201);
      expect(await listar(p.body.id)).toEqual([]);
    }
    expect((await enviar(60, 30, 'sim')).status).toBe(400);
    await api()
      .post(
        '/v1/plantas/' +
          randomUUID() +
          '/marcadores/' +
          randomUUID() +
          '/revisar',
      )
      .auth(gestor(), { type: 'bearer' })
      .expect(404);
  });
});
