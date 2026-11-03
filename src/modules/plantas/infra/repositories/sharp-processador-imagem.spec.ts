import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
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
});
