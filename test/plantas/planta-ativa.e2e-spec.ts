import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { ProcessamentoPlantaService } from '../../src/modules/plantas/application/services/processamento-planta.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { limparBanco } from '../helpers/database.js';
import {
  enviarPlanta,
  limparArquivosPlantas,
  png,
} from '../helpers/plantas.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';

describe('Planta ativa e tiles (e2e)', () => {
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
    await limparArquivosPlantas(app);
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });

  afterAll(async () => {
    await limparArquivosPlantas(app);
    await app?.close();
  });

  /** Envia uma imagem 600 x 400 e processa até ficar PRONTA. */
  async function plantaPronta(nome = 'Masterplan') {
    const planta = await enviarPlanta(
      app,
      usuarios.GESTOR.token,
      [['planta.png', await png(600, 400, '#36c')]],
      nome,
    );
    await app.get(ProcessamentoPlantaService).processarProxima();
    return planta;
  }

  function ativar(id: string, token = usuarios.GESTOR.token) {
    return request(app.getHttpServer())
      .post(`/v1/plantas/${id}/ativar`)
      .auth(token, { type: 'bearer' });
  }

  function obterAtiva() {
    return request(app.getHttpServer())
      .get('/v1/plantas/ativa')
      .auth(usuarios.CONSULTA.token, { type: 'bearer' });
  }

  it('ativa a planta pronta e entrega os metadados da ativa', async () => {
    const semAtiva = await obterAtiva().expect(404);
    expect(semAtiva.body.code).toBe('PLANTA_ATIVA_NAO_ENCONTRADA');

    const { id } = await plantaPronta();
    const res = await ativar(id).expect(200);
    expect(res.body).toMatchObject({ id, ativa: true, status: 'PRONTA' });

    const ativa = await obterAtiva().expect(200);
    expect(ativa.body).toMatchObject({
      id,
      ativa: true,
      larguraPx: 600,
      alturaPx: 400,
      maxZoom: 2,
      tamanhoTile: 256,
      tilesUrl: `/v1/plantas/${id}/tiles/{z}/{x}/{y}.webp`,
    });
  });

  it('mantém apenas uma planta ativa e registra a troca', async () => {
    const v1 = await plantaPronta('V1');
    const v2 = await plantaPronta('V2');
    await ativar(v1.id).expect(200);

    await ativar(v2.id, usuarios.ADMINISTRADOR.token).expect(200);
    await ativar(v2.id).expect(200); // de novo: sem efeito

    const ativas = await prisma.planta.findMany({ where: { ativa: true } });
    expect(ativas.map((p) => p.id)).toEqual([v2.id]);
    expect((await obterAtiva().expect(200)).body.id).toBe(v2.id);

    const auditoria = await prisma.historicoAuditoria.findMany({
      where: { acao: { in: ['ATIVAR', 'DESATIVAR'] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditoria.map((a) => [a.acao, a.entidadeId])).toEqual([
      ['ATIVAR', v1.id],
      ['DESATIVAR', v1.id],
      ['ATIVAR', v2.id],
    ]);
  });

  it('ativações simultâneas terminam com uma única planta ativa', async () => {
    const a = await plantaPronta('A');
    const b = await plantaPronta('B');

    const respostas = await Promise.all([ativar(a.id), ativar(b.id)]);

    expect(respostas.map((r) => r.status)).toEqual([200, 200]);
    expect(await prisma.planta.count({ where: { ativa: true } })).toBe(1);
  });

  it('não ativa planta em processamento, e só Administrador e Gestor ativam', async () => {
    const { id } = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['p.png', await png(10, 10)],
    ]);
    await prisma.planta.update({
      where: { id },
      data: { status: 'PROCESSANDO', processamentoIniciadoEm: new Date() },
    });

    const res = await ativar(id).expect(409);
    expect(res.body.code).toBe('PLANTA_NAO_PRONTA');

    const pronta = await plantaPronta();
    for (const perfil of ['COMERCIAL', 'CONSULTA'] as const) {
      await ativar(pronta.id, usuarios[perfil].token).expect(403);
    }
    await ativar('7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10').expect(404);
    expect(await prisma.planta.count({ where: { ativa: true } })).toBe(0);
  });

  it('serve os tiles sem token e com cache longo', async () => {
    const { id } = await plantaPronta();

    const res = await request(app.getHttpServer())
      .get(`/v1/plantas/${id}/tiles/2/2/1.webp`)
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (p: Buffer) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(await sharp(res.body as Buffer).metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
  });

  it('tiles inexistentes retornam 404 sem cache longo', async () => {
    const pronta = await plantaPronta();
    const enviada = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['p.png', await png(10, 10)],
    ]);

    for (const caminho of [
      `${pronta.id}/tiles/3/0/0.webp`,
      `${pronta.id}/tiles/2/3/0.webp`,
      `${enviada.id}/tiles/0/0/0.webp`,
      `7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10/tiles/0/0/0.webp`,
    ]) {
      const res = await request(app.getHttpServer())
        .get(`/v1/plantas/${caminho}`)
        .expect(404);
      expect(res.body.code).toBe('TILE_NAO_ENCONTRADO');
      expect(res.headers['cache-control']).toBeUndefined();
    }

    for (const caminho of [
      `${pronta.id}/tiles/-1/0/0.webp`,
      `${pronta.id}/tiles/a/0/0.webp`,
      `nao-e-uuid/tiles/0/0/0.webp`,
    ]) {
      const res = await request(app.getHttpServer())
        .get(`/v1/plantas/${caminho}`)
        .expect(400);
      expect(res.body.code).toBe('DADOS_INVALIDOS');
    }
  });
});
