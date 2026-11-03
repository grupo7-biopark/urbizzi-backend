import { Injectable } from '@nestjs/common';
import { readSheet } from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type { CelulaPlanilha } from '../../domain/models/linha-importacao.entity.js';
import type {
  CelulaModelo,
  FormatoPlanilha,
  Planilha,
} from '../../domain/repositories/planilha.interface.js';

const BOM = String.fromCharCode(0xfeff);
const SEPARADORES = [';', ',', '\t'];

/** Lê e gera planilhas XLSX (read/write-excel-file) e CSV (implementação própria). */
@Injectable()
export class ExcelPlanilha implements Planilha {
  async ler(
    conteudo: Buffer,
    formato: FormatoPlanilha,
  ): Promise<CelulaPlanilha[][]> {
    try {
      return formato === 'csv'
        ? lerCsv(decodificar(conteudo))
        : await lerXlsx(conteudo);
    } catch (erro) {
      if (erro instanceof BusinessRuleError) throw erro;
      throw new BusinessRuleError(
        'IMPORTACAO_ARQUIVO_INVALIDO',
        `Não foi possível ler o arquivo ${formato.toUpperCase()}`,
      );
    }
  }

  async gerar(
    linhas: CelulaModelo[][],
    formato: FormatoPlanilha,
  ): Promise<Buffer> {
    if (formato === 'csv') {
      // BOM para o Excel reconhecer UTF-8; ";" e vírgula decimal são o padrão pt-BR
      const csv = linhas
        .map((linha) => linha.map(celulaCsv).join(';'))
        .join('\r\n');
      return Buffer.from(`${BOM}${csv}\r\n`, 'utf8');
    }
    return writeXlsxFile(linhas, { sheet: 'Lotes' }).toBuffer();
  }
}

async function lerXlsx(conteudo: Buffer): Promise<CelulaPlanilha[][]> {
  // parseNumber mantém os números como texto, sem passar por ponto flutuante
  const linhas = await readSheet<string>(conteudo, {
    parseNumber: (numero) => numero,
  });
  return linhas.map((linha) =>
    linha.map((celula) => {
      if (celula === null || typeof celula === 'boolean') return celula;
      if (celula instanceof Date) return celula.toISOString();
      return String(celula);
    }),
  );
}

/** UTF-8 (com ou sem BOM); se não for UTF-8 válido, Windows-1252 (Excel pt-BR). */
function decodificar(conteudo: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      conteudo,
    );
  } catch {
    return new TextDecoder('windows-1252').decode(conteudo);
  }
}

/**
 * CSV no padrão RFC 4180 (aspas duplas, aspas escapadas com `""`, quebras de
 * linha dentro de aspas). O separador é detectado na primeira linha.
 */
export function lerCsv(texto: string): CelulaPlanilha[][] {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0];
  const separador = SEPARADORES.reduce((melhor, atual) =>
    primeiraLinha.split(atual).length > primeiraLinha.split(melhor).length
      ? atual
      : melhor,
  );
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let entreAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const caractere = texto[i];
    if (entreAspas) {
      if (caractere === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caractere === '"') {
        entreAspas = false;
      } else {
        campo += caractere;
      }
    } else if (caractere === '"') {
      entreAspas = true;
    } else if (caractere === separador) {
      linha.push(campo);
      campo = '';
    } else if (caractere === '\n' || caractere === '\r') {
      if (caractere === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += caractere;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

function celulaCsv(celula: CelulaModelo): string {
  const texto =
    celula === null
      ? ''
      : typeof celula === 'boolean'
        ? celula
          ? 'sim'
          : 'não'
        : String(celula);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}
