import type { CelulaPlanilha } from '../models/linha-importacao.entity.js';

export const PLANILHA = Symbol('PLANILHA');

export type FormatoPlanilha = 'csv' | 'xlsx';

/** Valor escrito no modelo de planilha. */
export type CelulaModelo = string | number | boolean | null;

/**
 * Porta técnica de leitura e escrita de planilhas, sem expor a biblioteca
 * usada. A leitura devolve só a primeira aba, com os números como texto.
 */
export interface Planilha {
  /** Lança `BusinessRuleError('IMPORTACAO_ARQUIVO_INVALIDO')` se não conseguir ler. */
  ler(conteudo: Buffer, formato: FormatoPlanilha): Promise<CelulaPlanilha[][]>;
  gerar(linhas: CelulaModelo[][], formato: FormatoPlanilha): Promise<Buffer>;
}
