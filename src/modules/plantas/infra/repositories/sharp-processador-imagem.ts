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
}
