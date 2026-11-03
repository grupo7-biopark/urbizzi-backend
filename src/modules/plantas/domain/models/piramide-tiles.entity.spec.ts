import { calcularPiramide } from './piramide-tiles.entity.js';

/** Resumo `zoom:colunas x linhas`, como na saída do libvips. */
function grade(largura: number, altura: number, tamanho?: number) {
  return calcularPiramide(largura, altura, tamanho).niveis.map(
    (n) => `${n.zoom}:${n.colunas}x${n.linhas}`,
  );
}

describe('calcularPiramide', () => {
  // Valores conferidos com a saída real do sharp/libvips (layout google).
  it.each([
    [256, 256, ['0:1x1']],
    [257, 100, ['0:1x1', '1:2x1']],
    [600, 400, ['0:1x1', '1:2x1', '2:3x2']],
    [513, 1, ['0:1x1', '1:2x1', '2:3x1']],
    [1025, 257, ['0:1x1', '1:2x1', '2:3x1', '3:5x2']],
    [3000, 5000, ['0:1x1', '1:1x2', '2:2x3', '3:3x5', '4:6x10', '5:12x20']],
  ])('%i x %i gera %j', (largura, altura, esperado) => {
    expect(grade(largura, altura)).toEqual(esperado);
  });

  it('calcula a planta real 3 x 3 de 4404 x 3482', () => {
    const piramide = calcularPiramide(13212, 10446);
    expect(piramide.maxZoom).toBe(6);
    expect(piramide.niveis[6]).toEqual({
      zoom: 6,
      largura: 13212,
      altura: 10446,
      colunas: 52,
      linhas: 41,
    });
    expect(piramide.niveis[5]).toMatchObject({
      largura: 6606,
      altura: 5223,
      colunas: 26,
      linhas: 21,
    });
    expect(piramide.totalTiles).toBe(
      piramide.niveis.reduce((t, n) => t + n.colunas * n.linhas, 0),
    );
    expect(piramide.totalTiles).toBe(2132 + 546 + 143 + 42 + 12 + 4 + 1);
  });

  it('aceita outro tamanho de tile', () => {
    expect(grade(1000, 500, 512)).toEqual(['0:1x1', '1:2x1']);
    expect(calcularPiramide(1, 1, 1)).toMatchObject({
      maxZoom: 0,
      totalTiles: 1,
    });
  });

  it.each([
    [0, 10, 256],
    [10, -1, 256],
    [10.5, 10, 256],
    [10, 10, 0],
  ])('rejeita dimensões inválidas %i x %i (tile %i)', (l, a, t) => {
    expect(() => calcularPiramide(l, a, t)).toThrow(RangeError);
  });
});
