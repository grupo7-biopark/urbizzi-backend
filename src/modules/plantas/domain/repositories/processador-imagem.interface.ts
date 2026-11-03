export const PROCESSADOR_IMAGEM = Symbol('PROCESSADOR_IMAGEM');

export type FormatoImagem = 'png' | 'jpeg';

export interface MetadadosImagem {
  formato: FormatoImagem;
  largura: number;
  altura: number;
}

/** Porta técnica para ler e transformar imagens (implementada com sharp). */
export interface ProcessadorImagem {
  /**
   * Lê formato e dimensões pelo conteúdo do arquivo, sem decodificar os
   * pixels. Devolve null se não for uma imagem PNG ou JPEG válida.
   */
  lerMetadados(caminho: string): Promise<MetadadosImagem | null>;
}
