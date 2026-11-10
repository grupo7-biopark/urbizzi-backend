import type { INestApplication } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import {
  ProcessamentoPlantaService,
  TEMPO_MAXIMO_PROCESSAMENTO_MS,
} from '../../src/modules/plantas/application/services/processamento-planta.service.js';
import { calcularPiramide } from '../../src/modules/plantas/domain/models/piramide-tiles.entity.js';
import {
  PLANTA_REPOSITORY,
  type PlantaRepository,
} from '../../src/modules/plantas/domain/repositories/planta.repository.interface.js';
import { PlantasWorker } from '../../src/modules/plantas/infra/workers/plantas.worker.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { StorageService } from '../../src/shared/infra/storage/storage.service.js';
import { limparBanco } from '../helpers/database.js';
import { criarAppTeste } from '../helpers/feature-test.js';
import {
  enviarPlanta,
  limparArquivosPlantas,
  png,
} from '../helpers/plantas.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';

async function fatias2x2(): Promise<[string, Buffer][]> {
  return [
    ['fatia_01_01.png', await png(300, 200, '#f00')],
    ['fatia_01_02.png', await png(300, 200, '#0f0')],
    ['fatia_02_01.png', await png(300, 200, '#00f')],
    ['fatia_02_02.png', await png(300, 200, '#ff0')],
  ];
}

describe('Processamento da planta (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let processamento: ProcessamentoPlantaService;
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
    processamento = app.get(ProcessamentoPlantaService);
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

  function detalhar(id: string) {
    return request(app.getHttpServer())
      .get(`/v1/plantas/${id}`)
      .auth(usuarios.CONSULTA.token, { type: 'bearer' })
      .expect(200);
  }

  function reprocessar(id: string, token = usuarios.GESTOR.token) {
    return request(app.getHttpServer())
      .post(`/v1/plantas/${id}/reprocessar`)
      .auth(token, { type: 'bearer' });
  }

  async function tilesNoBucket(id: string): Promise<string[]> {
    const chaves: string[] = [];
    let continuationToken: string | undefined;
    do {
      const pagina = await storage.list('tiles', `plantas/${id}/`, {
        limit: 1000,
        continuationToken,
      });
      chaves.push(...pagina.items.map((item) => item.key));
      continuationToken = pagina.continuationToken ?? undefined;
    } while (continuationToken);
    return chaves.sort();
  }

  it('processa a grade 2 x 2 e envia a pirâmide completa ao bucket', async () => {
    const { id } = await enviarPlanta(
      app,
      usuarios.GESTOR.token,
      await fatias2x2(),
    );

    await expect(processamento.processarProxima()).resolves.toEqual({
      plantaId: id,
      status: 'PRONTA',
    });
    await expect(processamento.processarProxima()).resolves.toBeNull();

    const { body } = await detalhar(id);
    expect(body).toMatchObject({
      status: 'PRONTA',
      larguraPx: 600,
      alturaPx: 400,
      maxZoom: 2,
      tamanhoTile: 256,
      mensagemErro: null,
    });

    const piramide = calcularPiramide(600, 400);
    const { tilesPath } = await prisma.planta.findUniqueOrThrow({
      where: { id },
    });
    expect(tilesPath).toMatch(new RegExp(`^plantas/${id}/[a-f0-9-]{36}$`));
    const esperadas: string[] = [];
    for (const n of piramide.niveis)
      for (let x = 0; x < n.colunas; x++)
        for (let y = 0; y < n.linhas; y++)
          esperadas.push(`${tilesPath}/${n.zoom}/${x}/${y}.webp`);
    expect(await tilesNoBucket(id)).toEqual(esperadas.sort());

    // O tile 2/2/1 fica na fatia amarela (canto inferior direito).
    const partes: Buffer[] = [];
    for await (const parte of await storage.download(
      'tiles',
      `${tilesPath}/2/2/1.webp`,
    ))
      partes.push(parte as Buffer);
    const tile = sharp(Buffer.concat(partes));
    expect(await tile.metadata()).toMatchObject({
      format: 'webp',
      width: 256,
      height: 256,
    });
    const { data } = await tile
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200);
    expect(data[1]).toBeGreaterThan(200);
    expect(data[2]).toBeLessThan(60);
  });

  it('cada planta é processada uma vez, mesmo com consumidores simultâneos', async () => {
    const a = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['a.png', await png(50, 50)],
    ]);
    const b = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['b.png', await png(60, 40)],
    ]);

    const resultados = await Promise.all([
      processamento.processarProxima(),
      processamento.processarProxima(),
      processamento.processarProxima(),
    ]);

    const processadas = resultados
      .filter((r) => r !== null)
      .map((r) => r.plantaId)
      .sort();
    expect(processadas).toEqual([a.id, b.id].sort());
    expect(resultados.filter((r) => r === null)).toHaveLength(1);
  });

  it('falha deixa ERRO com mensagem e permite reprocessar', async () => {
    const imagem = await png(80, 60);
    const { id } = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['p.png', imagem],
    ]);
    const { originais } = await prisma.planta.findUniqueOrThrow({
      where: { id },
    });
    // Corrompe o original no bucket
    await storage.upload({
      bucket: 'originais',
      key: originais[0],
      body: Buffer.from('corrompido'),
    });

    await expect(processamento.processarProxima()).resolves.toMatchObject({
      plantaId: id,
      status: 'ERRO',
    });
    const comErro = await detalhar(id);
    expect(comErro.body).toMatchObject({ status: 'ERRO', larguraPx: null });
    expect(comErro.body.mensagemErro).toContain('Não foi possível gerar');

    await reprocessar(id, usuarios.COMERCIAL.token).expect(403);

    await storage.upload({
      bucket: 'originais',
      key: originais[0],
      body: imagem,
    });
    const res = await reprocessar(id).expect(200);
    expect(res.body).toMatchObject({ status: 'ENVIADA', mensagemErro: null });

    await expect(processamento.processarProxima()).resolves.toMatchObject({
      status: 'PRONTA',
    });
    const pronta = await detalhar(id);
    expect(pronta.body).toMatchObject({ status: 'PRONTA', larguraPx: 80 });

    const naoReprocessavel = await reprocessar(id).expect(409);
    expect(naoReprocessavel.body.code).toBe('PLANTA_NAO_REPROCESSAVEL');

    const acoes = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(acoes.map((a) => a.acao)).toEqual(['CRIAR', 'REPROCESSAR']);
  });

  it('marca como ERRO um processamento interrompido', async () => {
    const { id } = await enviarPlanta(app, usuarios.GESTOR.token, [
      ['p.png', await png(10, 10)],
    ]);
    await prisma.planta.update({
      where: { id },
      data: {
        status: 'PROCESSANDO',
        processamentoIniciadoEm: new Date(Date.now() - 31 * 60 * 1000),
      },
    });

    await expect(processamento.processarProxima()).resolves.toBeNull();

    const { body } = await detalhar(id);
    expect(body.status).toBe('ERRO');
    expect(body.mensagemErro).toContain('interrompido');
    await reprocessar(id).expect(200);
  });

  it.each(['sucesso', 'falha'] as const)(
    'ignora %s tardio após timeout e publicação por outra instância',
    async (desfecho) => {
      const { id } = await enviarPlanta(app, usuarios.GESTOR.token, [
        ['p.png', await png(80, 60, '#0f0')],
      ]);
      const appB = await criarAppTeste();
      const workerB = appB.get(ProcessamentoPlantaService);
      let avisarUpload!: () => void;
      let liberarUpload!: () => void;
      const uploadIniciado = new Promise<void>((resolve) => {
        avisarUpload = resolve;
      });
      const espera = new Promise<void>((resolve) => {
        liberarUpload = resolve;
      });
      const upload = storage.upload.bind(storage);
      // A gera um tile diferente para detectar sobrescrita dos bytes de B.
      vi.spyOn(storage, 'download').mockResolvedValueOnce(
        Readable.from([await png(40, 30, '#f00')]),
      );
      vi.spyOn(storage, 'upload').mockImplementationOnce(async (input) => {
        avisarUpload();
        await espera;
        if (desfecho === 'falha') {
          if (!Buffer.isBuffer(input.body)) input.body.destroy();
          throw new Error('Falha tardia do upload');
        }
        await upload(input);
      });
      const workerA = processamento.processarProxima();
      try {
        await Promise.race([
          uploadIniciado,
          workerA.then(() => {
            throw new Error('A terminou sem chegar à barreira de upload');
          }),
        ]);
        const onde = { where: { id } };
        const primeira = await prisma.planta.findUniqueOrThrow(onde);
        expect(primeira.processamentoTentativaId).toEqual(expect.any(String));
        const repositorio = app.get<PlantaRepository>(PLANTA_REPOSITORY);
        const copiaAntiga = (await repositorio.findById(id))!;
        copiaAntiga.falharProcessamento('Falha da tentativa anterior');
        const relogio = vi
          .spyOn(Date, 'now')
          .mockReturnValue(
            primeira.processamentoIniciadoEm!.getTime() +
              TEMPO_MAXIMO_PROCESSAMENTO_MS +
              1,
          );
        try {
          await expect(workerB.processarProxima()).resolves.toBeNull();
        } finally {
          relogio.mockRestore();
        }
        expect(await prisma.planta.findUniqueOrThrow(onde)).toMatchObject({
          status: 'ERRO',
          processamentoTentativaId: null,
        });
        const reenvios = await Promise.all([reprocessar(id), reprocessar(id)]);
        expect(reenvios.map(({ status }) => status).sort()).toEqual([200, 409]);
        const storageB = appB.get(StorageService);
        const uploadB = storageB.upload.bind(storageB);
        vi.spyOn(storageB, 'upload').mockImplementationOnce(async (input) => {
          // Mesmo em PROCESSANDO novamente, o identificador de A é inválido.
          const publicou = await repositorio.finalizarProcessamento(
            copiaAntiga,
            primeira.processamentoTentativaId!,
          );
          expect(publicou).toBe(false);
          await prisma.planta.update({
            ...onde,
            data: { nome: 'Planta editada durante o processamento' },
          });
          await uploadB(input);
        });
        await expect(workerB.processarProxima()).resolves.toEqual({
          plantaId: id,
          status: 'PRONTA',
        });
        await request(appB.getHttpServer())
          .post(`/v1/plantas/${id}/ativar`)
          .auth(usuarios.GESTOR.token, { type: 'bearer' })
          .expect(200);
        const publicada = await prisma.planta.findUniqueOrThrow(onde);
        expect(publicada).toMatchObject({
          status: 'PRONTA',
          ativa: true,
          nome: 'Planta editada durante o processamento',
          larguraPx: 80,
          alturaPx: 60,
          processamentoTentativaId: null,
          mensagemErro: null,
        });
        const prefixoAntigo = `plantas/${id}/${primeira.processamentoTentativaId}`;
        expect(publicada.tilesPath).not.toBe(prefixoAntigo);
        const tile = () =>
          request(appB.getHttpServer())
            .get(`/v1/plantas/${id}/tiles/0/0/0.webp`)
            .buffer(true)
            .expect(200);
        const antes = (await tile()).body as Buffer;

        liberarUpload();
        await expect(workerA).resolves.toBeNull();
        expect(await prisma.planta.findUniqueOrThrow(onde)).toEqual(publicada);
        expect((await tile()).body).toEqual(antes);
        expect(await tilesNoBucket(id)).toEqual(
          [
            `${publicada.tilesPath}/0/0/0.webp`,
            ...(desfecho === 'sucesso' ? [`${prefixoAntigo}/0/0/0.webp`] : []),
          ].sort(),
        );
      } finally {
        liberarUpload();
        try {
          await workerA;
        } finally {
          vi.restoreAllMocks();
          await appB.close();
        }
      }
    },
    30_000,
  );

  it('o worker processa a fila em segundo plano', async () => {
    const worker = app.get(PlantasWorker);
    const { id } = await enviarPlanta(
      app,
      usuarios.GESTOR.token,
      await fatias2x2(),
    );
    worker.iniciar();
    try {
      await vi.waitFor(
        async () => {
          // A API continua respondendo enquanto o worker trabalha.
          await request(app.getHttpServer()).get('/health').expect(200);
          const { body } = await detalhar(id);
          expect(body.status).toBe('PRONTA');
        },
        { timeout: 15_000, interval: 200 },
      );
    } finally {
      await worker.parar();
    }
  });

  it('reprocessar exige planta existente', async () => {
    const res = await reprocessar(
      '7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10',
    ).expect(404);
    expect(res.body.code).toBe('PLANTA_NAO_ENCONTRADA');
  });
});
