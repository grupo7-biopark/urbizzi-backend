import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { StorageService } from '../../src/shared/infra/storage/storage.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';

const PASTA_UPLOADS = join(tmpdir(), 'urbizzi-uploads');

function imagem(
  width: number,
  height: number,
  formato: 'png' | 'jpeg' | 'webp' = 'png',
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: '#4a8' },
  })
    .toFormat(formato)
    .toBuffer();
}

async function fatias(linhas: number, colunas: number, sem: string[] = []) {
  const png = await imagem(40, 30);
  const lista: [string, Buffer][] = [];
  for (let l = 1; l <= linhas; l++) {
    for (let c = 1; c <= colunas; c++) {
      const nome = `fatia_0${l}_0${c}.png`;
      if (!sem.includes(nome)) lista.push([nome, png]);
    }
  }
  return lista;
}

async function arquivosTemporarios(): Promise<string[]> {
  return readdir(PASTA_UPLOADS).catch(() => []);
}

describe('Plantas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let usuarios: UsuariosTeste;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
  });

  beforeEach(async () => {
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });

  afterEach(async () => {
    // Remove do bucket só os originais criados por este teste.
    const plantas = await prisma.planta.findMany();
    await Promise.all(
      plantas
        .flatMap((p) => p.originais)
        .map((chave) => storage.delete('originais', chave)),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  function enviar(
    arquivos: [string, Buffer][],
    nome: string | null = 'Masterplan',
    token = usuarios.GESTOR.token,
  ) {
    const req = request(app.getHttpServer())
      .post('/v1/plantas')
      .auth(token, { type: 'bearer' });
    if (nome !== null) req.field('nome', nome);
    for (const [arquivo, conteudo] of arquivos) {
      req.attach('arquivos', conteudo, arquivo);
    }
    return req;
  }

  async function baixar(chave: string): Promise<Buffer> {
    const partes: Buffer[] = [];
    for await (const parte of await storage.download('originais', chave)) {
      partes.push(parte as Buffer);
    }
    return Buffer.concat(partes);
  }

  it('envia imagem única e cria a planta ENVIADA, com auditoria', async () => {
    const antes = await arquivosTemporarios();
    const jpeg = await imagem(120, 80, 'jpeg');

    const res = await enviar(
      [['planta final.jpeg', jpeg]],
      '  Masterplan  ',
    ).expect(201);

    expect(res.body).toMatchObject({
      nome: 'Masterplan',
      versao: 1,
      status: 'ENVIADA',
      ativa: false,
      gradeLinhas: 1,
      gradeColunas: 1,
      larguraPx: null,
      maxZoom: null,
      criadoPorId: usuarios.GESTOR.id,
    });
    const planta = await prisma.planta.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(planta.originais).toEqual([`plantas/${planta.id}/imagem.jpg`]);
    expect((await baixar(planta.originais[0])).equals(jpeg)).toBe(true);

    const auditoria = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: planta.id },
    });
    expect(auditoria).toMatchObject([
      {
        acao: 'CRIAR',
        entidadeTipo: 'Planta',
        usuarioId: usuarios.GESTOR.id,
      },
    ]);
    expect(await arquivosTemporarios()).toEqual(antes);
  });

  it('envia a grade completa de 9 fatias e numera as versões', async () => {
    await enviar([['planta.png', await imagem(10, 10)]]).expect(201);

    const res = await enviar(await fatias(3, 3)).expect(201);

    expect(res.body).toMatchObject({
      versao: 2,
      gradeLinhas: 3,
      gradeColunas: 3,
    });
    const planta = await prisma.planta.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(planta.originais).toHaveLength(9);
    expect(planta.originais[0]).toBe(`plantas/${planta.id}/fatia_01_01.png`);
    expect(planta.originais[8]).toBe(`plantas/${planta.id}/fatia_03_03.png`);
    const listagem = await storage.list('originais', `plantas/${planta.id}/`);
    expect(listagem.items).toHaveLength(9);
  });

  it('dois envios simultâneos recebem versões diferentes', async () => {
    const png = await imagem(10, 10);
    const [a, b] = await Promise.all([
      enviar([['a.png', png]]),
      enviar([['b.png', png]]),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect([a.body.versao, b.body.versao].sort()).toEqual([1, 2]);
  });

  it('grade incompleta retorna 400 com as fatias faltantes e não grava nada', async () => {
    const antes = await arquivosTemporarios();

    const res = await enviar(
      await fatias(3, 3, ['fatia_02_02.png', 'fatia_03_01.png']),
    ).expect(400);

    expect(res.body).toMatchObject({
      code: 'PLANTA_GRADE_INCOMPLETA',
      details: [
        { field: 'arquivos', messages: ['fatia_02_02', 'fatia_03_01'] },
      ],
    });
    expect(await prisma.planta.count()).toBe(0);
    expect(await arquivosTemporarios()).toEqual(antes);
  });

  it('fatias com dimensões diferentes retornam 400', async () => {
    const lista = await fatias(1, 2);
    lista[1] = [lista[1][0], await imagem(41, 30)];

    const res = await enviar(lista).expect(400);

    expect(res.body.code).toBe('PLANTA_FATIAS_DIMENSOES_DIFERENTES');
  });

  it('valida formato pelo conteúdo do arquivo', async () => {
    const res = await enviar([
      ['fatia_01_01.png', await imagem(40, 30, 'webp')],
      ['fatia_01_02.png', Buffer.from('não é imagem')],
    ]).expect(400);

    expect(res.body).toMatchObject({
      code: 'PLANTA_FORMATO_INVALIDO',
      details: [
        { field: 'arquivos', messages: ['fatia_01_01.png', 'fatia_01_02.png'] },
      ],
    });
  });

  it('exige arquivo e nome, e apaga o upload se o DTO for inválido', async () => {
    const antes = await arquivosTemporarios();

    const semArquivo = await enviar([]).expect(400);
    expect(semArquivo.body.code).toBe('ARQUIVO_OBRIGATORIO');

    const semNome = await enviar(
      [['planta.png', await imagem(10, 10)]],
      null,
    ).expect(400);
    expect(semNome.body.code).toBe('DADOS_INVALIDOS');

    expect(await prisma.planta.count()).toBe(0);
    expect(await arquivosTemporarios()).toEqual(antes);
  });

  it('só Administrador e Gestor enviam a planta', async () => {
    const png = await imagem(10, 10);
    await enviar([['p.png', png]], 'P', usuarios.ADMINISTRADOR.token).expect(
      201,
    );
    for (const perfil of ['COMERCIAL', 'CONSULTA'] as const) {
      const res = await enviar(
        [['p.png', png]],
        'P',
        usuarios[perfil].token,
      ).expect(403);
      expect(res.body.code).toBe('ACESSO_NEGADO');
    }
    await request(app.getHttpServer()).post('/v1/plantas').expect(401);
  });

  it('lista e detalha as plantas para qualquer perfil', async () => {
    const png = await imagem(10, 10);
    const v1 = await enviar([['p.png', png]], 'V1').expect(201);
    const v2 = await enviar([['p.png', png]], 'V2').expect(201);
    const token = usuarios.CONSULTA.token;

    const lista = await request(app.getHttpServer())
      .get('/v1/plantas')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(lista.body.meta).toMatchObject({ total: 2 });
    expect(lista.body.data.map((p: { nome: string }) => p.nome)).toEqual([
      'V2',
      'V1',
    ]);

    const filtrada = await request(app.getHttpServer())
      .get('/v1/plantas?status=PRONTA,ERRO')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(filtrada.body.meta.total).toBe(0);

    await request(app.getHttpServer())
      .get('/v1/plantas?status=OUTRO')
      .auth(token, { type: 'bearer' })
      .expect(400);

    const detalhe = await request(app.getHttpServer())
      .get(`/v1/plantas/${v1.body.id}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(detalhe.body).toEqual(v1.body);
    expect(detalhe.body).not.toHaveProperty('originais');
    expect(v2.body.versao).toBe(2);

    const ausente = await request(app.getHttpServer())
      .get('/v1/plantas/7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10')
      .auth(token, { type: 'bearer' })
      .expect(404);
    expect(ausente.body.code).toBe('PLANTA_NAO_ENCONTRADA');
  });
});
