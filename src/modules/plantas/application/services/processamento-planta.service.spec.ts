import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import type {
  Storage,
  UploadInput,
} from '../../../../shared/application/storage/storage.interface.js';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import { calcularPiramide } from '../../domain/models/piramide-tiles.entity.js';
import { Planta } from '../../domain/models/planta.entity.js';
import type { PlantaRepository } from '../../domain/repositories/planta.repository.interface.js';
import type { ProcessadorImagem } from '../../domain/repositories/processador-imagem.interface.js';
import {
  ProcessamentoPlantaService,
  TEMPO_MAXIMO_PROCESSAMENTO_MS,
} from './processamento-planta.service.js';

/** Grava os tiles que o libvips geraria para a imagem, no layout z/y/x. */
async function gravarTiles(destino: string, largura: number, altura: number) {
  for (const n of calcularPiramide(largura, altura).niveis) {
    for (let y = 0; y < n.linhas; y++) {
      for (let x = 0; x < n.colunas; x++) {
        const arquivo = join(destino, `${n.zoom}`, `${y}`, `${x}.webp`);
        await mkdir(dirname(arquivo), { recursive: true });
        await writeFile(arquivo, `${n.zoom}/${x}/${y}`);
      }
    }
  }
}

function plantaEmProcessamento(originais = ['plantas/p/fatia_01_01.png']) {
  return Planta.create({
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    nome: 'P',
    versao: 1,
    gradeLinhas: 1,
    gradeColunas: originais.length,
    originais,
    criadoPorId: 'f1b2c3d4-0000-4000-8000-000000000001',
  });
}

function setup() {
  const repository = {
    findById: vi.fn(),
    list: vi.fn(),
    proximaVersao: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    reservarProxima: vi.fn(),
    findAtiva: vi.fn(),
    travarAtiva: vi.fn(),
    marcarInterrompidas: vi.fn(),
  } satisfies PlantaRepository;
  const enviados = new Map<string, string>();
  const baixados: string[] = [];
  const storage = {
    upload: vi.fn(async ({ key, body }: UploadInput) => {
      const partes: Buffer[] = [];
      for await (const parte of body as Readable) partes.push(parte);
      enviados.set(key, Buffer.concat(partes).toString());
    }),
    download: vi.fn(async (_bucket: string, chave: string) =>
      Readable.from([`conteudo de ${chave}`]),
    ),
    delete: vi.fn(),
    list: vi.fn(),
    getSignedUrl: vi.fn(),
  } satisfies Storage;
  const processador = {
    lerMetadados: vi.fn(),
    gerarTiles: vi.fn(
      async (arquivos: string[], _colunas: number, destino: string) => {
        for (const arquivo of arquivos)
          baixados.push(await readFile(arquivo, 'utf8'));
        await gravarTiles(destino, 600, 400);
        return { largura: 600, altura: 400 };
      },
    ),
  } satisfies ProcessadorImagem;
  const service = new ProcessamentoPlantaService(
    repository,
    processador,
    storage,
  );
  return { service, repository, storage, processador, enviados, baixados };
}

describe('ProcessamentoPlantaService', () => {
  it('retorna null com a fila vazia, depois de marcar as interrompidas', async () => {
    const { service, repository } = setup();
    repository.reservarProxima.mockResolvedValue(null);
    const antes = Date.now();

    await expect(service.processarProxima()).resolves.toBeNull();

    const [limite, mensagem] = repository.marcarInterrompidas.mock.calls[0];
    expect((limite as Date).getTime()).toBeGreaterThanOrEqual(
      antes - TEMPO_MAXIMO_PROCESSAMENTO_MS,
    );
    expect((limite as Date).getTime()).toBeLessThanOrEqual(
      Date.now() - TEMPO_MAXIMO_PROCESSAMENTO_MS,
    );
    expect(mensagem).toContain('interrompido');
  });

  it('gera e envia todos os tiles e deixa a planta PRONTA', async () => {
    const { service, repository, processador, enviados, baixados } = setup();
    const planta = plantaEmProcessamento([
      'plantas/p/fatia_01_01.png',
      'plantas/p/fatia_01_02.png',
    ]);
    repository.reservarProxima.mockResolvedValue(planta);

    await expect(service.processarProxima()).resolves.toEqual({
      plantaId: planta.id,
      status: 'PRONTA',
    });

    expect(baixados).toEqual([
      'conteudo de plantas/p/fatia_01_01.png',
      'conteudo de plantas/p/fatia_01_02.png',
    ]);
    expect(processador.gerarTiles).toHaveBeenCalledWith(
      expect.any(Array),
      2,
      expect.any(String),
      256,
    );
    // 600 x 400: 1 + 2 + 6 tiles; a chave usa z/x/y e o disco usa z/y/x.
    expect(enviados.size).toBe(9);
    expect(enviados.get(`plantas/${planta.id}/2/2/1.webp`)).toBe('2/2/1');
    expect(enviados.get(`plantas/${planta.id}/0/0/0.webp`)).toBe('0/0/0');
    expect(planta).toMatchObject({
      status: 'PRONTA',
      larguraPx: 600,
      alturaPx: 400,
      maxZoom: 2,
      tamanhoTile: 256,
      tilesPath: `plantas/${planta.id}`,
    });
    expect(repository.update).toHaveBeenCalledWith(planta);
  });

  it('marca ERRO com mensagem genérica e remove a pasta temporária', async () => {
    const { service, repository, processador } = setup();
    const planta = plantaEmProcessamento();
    repository.reservarProxima.mockResolvedValue(planta);
    let pasta = '';
    const falha = new Error('vips: detalhes internos');
    processador.gerarTiles.mockImplementation(async (_a, _c, destino) => {
      pasta = dirname(destino);
      throw falha;
    });

    const resultado = await service.processarProxima();

    expect(resultado).toEqual({
      plantaId: planta.id,
      status: 'ERRO',
      erro: falha,
    });
    expect(planta.status).toBe('ERRO');
    expect(planta.mensagemErro).toContain('Não foi possível gerar os tiles');
    expect(planta.mensagemErro).not.toContain('vips');
    expect(repository.update).toHaveBeenCalledWith(planta);
    expect(existsSync(pasta)).toBe(false);
  });

  it('usa a mensagem de erros de domínio', async () => {
    const { service, repository, processador } = setup();
    const planta = plantaEmProcessamento();
    repository.reservarProxima.mockResolvedValue(planta);
    processador.gerarTiles.mockRejectedValue(
      new BusinessRuleError('X', 'Mensagem de negócio'),
    );

    await service.processarProxima();

    expect(planta.mensagemErro).toBe('Mensagem de negócio');
  });

  it('para de enviar tiles na primeira falha', async () => {
    const { service, repository, storage } = setup();
    repository.reservarProxima.mockResolvedValue(plantaEmProcessamento());
    storage.upload.mockImplementation(async ({ body }: UploadInput) => {
      (body as Readable).destroy();
      throw new Error('armazenamento fora');
    });

    const resultado = await service.processarProxima();

    expect(resultado?.status).toBe('ERRO');
    // 8 envios simultâneos começam; nenhum outro depois da falha.
    expect(storage.upload.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('falha se o original não puder ser baixado', async () => {
    const { service, repository, storage, processador } = setup();
    const planta = plantaEmProcessamento();
    repository.reservarProxima.mockResolvedValue(planta);
    storage.download.mockRejectedValue(new Error('sem acesso'));

    await expect(service.processarProxima()).resolves.toMatchObject({
      status: 'ERRO',
    });
    expect(processador.gerarTiles).not.toHaveBeenCalled();
  });
});
