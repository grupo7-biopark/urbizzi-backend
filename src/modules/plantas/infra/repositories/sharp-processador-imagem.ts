import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type {
  FormatoImagem,
  MetadadosImagem,
  ProcessadorImagem,
} from '../../domain/repositories/processador-imagem.interface.js';

const FORMATOS: readonly string[] = ['png', 'jpeg'] satisfies FormatoImagem[];

// Sem cache de operações: imagens grandes não ficam retidas na memória e os
// arquivos temporários não ficam abertos (o que impede apagá-los no Windows).
sharp.cache(false);

@Injectable()
export class SharpProcessadorImagem implements ProcessadorImagem {
  async lerMetadados(caminho: string): Promise<MetadadosImagem | null> {
    try {
      // Lê só o cabeçalho; o limite de pixels fica para o processamento.
      const { format, width, height } = await sharp(caminho, {
        limitInputPixels: false,
      }).metadata();
      if (!FORMATOS.includes(format) || !width || !height) return null;
      return {
        formato: format as FormatoImagem,
        largura: width,
        altura: height,
      };
    } catch {
      return null;
    }
  }

  async gerarTiles(
    arquivos: string[],
    colunas: number,
    destino: string,
    tamanhoTile: number,
  ): Promise<{ largura: number; altura: number }> {
    // Leitura sequencial (padrão): o libvips decodifica em faixas e junta as
    // fatias sem montar a imagem completa na memória.
    const imagem =
      arquivos.length === 1
        ? sharp(arquivos[0])
        : sharp(arquivos, { join: { across: colunas } });
    const info = await imagem
      .webp({ quality: 85 })
      .tile({ size: tamanhoTile, layout: 'google', skipBlanks: -1 })
      .toFile(destino);
    return { largura: info.width, altura: info.height };
  }
}
