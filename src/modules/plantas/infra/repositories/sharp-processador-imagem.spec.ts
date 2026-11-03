import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { calcularPiramide } from '../../domain/models/piramide-tiles.entity.js';
import { SharpProcessadorImagem } from './sharp-processador-imagem.js';

describe('SharpProcessadorImagem', () => {
  const processador = new SharpProcessadorImagem();
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'processador-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function criar(width: number, height: number) {
    return sharp({
      create: { width, height, channels: 3, background: '#3a7' },
    });
  }

  it.each([
    ['png', 'png'],
    ['jpeg', 'jpeg'],
  ] as const)('lê formato e dimensões de %s', async (formato, esperado) => {
    const caminho = join(dir, `a.${formato}`);
    await criar(40, 30).toFormat(formato).toFile(caminho);
    await expect(processador.lerMetadados(caminho)).resolves.toEqual({
      formato: esperado,
      largura: 40,
      altura: 30,
    });
  });

  it('rejeita outros formatos de imagem, mesmo com extensão .png', async () => {
    const caminho = join(dir, 'webp.png');
    await criar(10, 10).webp().toFile(caminho);
    await expect(processador.lerMetadados(caminho)).resolves.toBeNull();
  });

  it('rejeita arquivo que não é imagem', async () => {
    const caminho = join(dir, 'texto.png');
    await writeFile(caminho, 'não sou uma imagem');
    await expect(processador.lerMetadados(caminho)).resolves.toBeNull();
    await expect(
      processador.lerMetadados(join(dir, 'inexistente.png')),
    ).resolves.toBeNull();
  });

  describe('gerarTiles', () => {
    async function cor(arquivo: string, x: number, y: number) {
      const { data } = await sharp(arquivo)
        .extract({ left: x, top: y, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return [...data];
    }

    it('junta as fatias na ordem da grade e gera a pirâmide esperada', async () => {
      const cores = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
      const fatias: string[] = [];
      for (const [i, background] of cores.entries()) {
        const caminho = join(dir, `fatia-${i}.png`);
        await sharp({
          create: { width: 300, height: 200, channels: 3, background },
        })
          .png()
          .toFile(caminho);
        fatias.push(caminho);
      }
      const destino = join(dir, 'tiles-grade');

      await expect(
        processador.gerarTiles(fatias, 2, destino, 256),
      ).resolves.toEqual({ largura: 600, altura: 400 });

      for (const nivel of calcularPiramide(600, 400).niveis) {
        for (let y = 0; y < nivel.linhas; y++)
          for (let x = 0; x < nivel.colunas; x++)
            expect(
              existsSync(join(destino, `${nivel.zoom}/${y}/${x}.webp`)),
            ).toBe(true);
      }
      // Zoom 2 (original): o tile 2/1/2 começa em (512, 256), na fatia amarela de baixo à direita.
      const amarelo = await cor(join(destino, '2/1/2.webp'), 10, 10);
      expect(amarelo[0]).toBeGreaterThan(200);
      expect(amarelo[1]).toBeGreaterThan(200);
      expect(amarelo[2]).toBeLessThan(60);
      const vermelho = await cor(join(destino, '2/0/0.webp'), 10, 10);
      expect(vermelho[0]).toBeGreaterThan(200);
      expect(vermelho[1]).toBeLessThan(60);
    });

    it('gera os tiles de uma imagem única', async () => {
      const caminho = join(dir, 'unica.jpeg');
      await criar(300, 100).jpeg().toFile(caminho);
      const destino = join(dir, 'tiles-unica');

      await expect(
        processador.gerarTiles([caminho], 1, destino, 256),
      ).resolves.toEqual({ largura: 300, altura: 100 });
      expect(existsSync(join(destino, '1/0/1.webp'))).toBe(true);
    });

    it('rejeita arquivo que não é imagem', async () => {
      const caminho = join(dir, 'ruim.png');
      await writeFile(caminho, 'x');
      await expect(
        processador.gerarTiles([caminho], 1, join(dir, 'tiles-ruim'), 256),
      ).rejects.toThrow();
    });
  });
});
