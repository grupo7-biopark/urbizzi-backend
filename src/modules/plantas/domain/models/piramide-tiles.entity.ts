export interface NivelTiles {
  zoom: number;
  /** Dimensões da imagem reduzida neste nível, em pixels. */
  largura: number;
  altura: number;
  colunas: number;
  linhas: number;
}

export interface PiramideTiles {
  tamanhoTile: number;
  maxZoom: number;
  niveis: NivelTiles[];
  totalTiles: number;
}

/**
 * Pirâmide no layout "google" do libvips (`<z>/<y>/<x>`): no zoom máximo a
 * imagem tem o tamanho original; cada nível abaixo tem metade da largura e
 * da altura (arredondadas para cima), até a imagem caber em um tile no zoom
 * 0. Os tiles das bordas são completados com fundo branco.
 */
export function calcularPiramide(
  largura: number,
  altura: number,
  tamanhoTile = 256,
): PiramideTiles {
  if (
    !Number.isInteger(largura) ||
    !Number.isInteger(altura) ||
    !Number.isInteger(tamanhoTile) ||
    largura < 1 ||
    altura < 1 ||
    tamanhoTile < 1
  ) {
    throw new RangeError('Dimensões da pirâmide devem ser inteiros positivos');
  }
  const maior = Math.max(largura, altura);
  let maxZoom = 0;
  while (tamanhoTile * 2 ** maxZoom < maior) maxZoom++;

  const niveis: NivelTiles[] = [];
  for (let zoom = 0; zoom <= maxZoom; zoom++) {
    const escala = 2 ** (maxZoom - zoom);
    const larguraNivel = Math.ceil(largura / escala);
    const alturaNivel = Math.ceil(altura / escala);
    niveis.push({
      zoom,
      largura: larguraNivel,
      altura: alturaNivel,
      colunas: Math.ceil(larguraNivel / tamanhoTile),
      linhas: Math.ceil(alturaNivel / tamanhoTile),
    });
  }
  const totalTiles = niveis.reduce((t, n) => t + n.colunas * n.linhas, 0);
  return { tamanhoTile, maxZoom, niveis, totalTiles };
}
