export class ErroImportacaoDto {
  /**
   * Linha da planilha (o cabeçalho é a linha 1)
   * @example 3
   */
  linha: number;
  /** @example ['area_m2 é obrigatório', 'Lote já cadastrado no sistema'] */
  mensagens: string[];
}

export class ResultadoImportacaoDto {
  /**
   * `true` só quando a importação foi confirmada e gravada
   * @example false
   */
  importado: boolean;
  /**
   * Linhas preenchidas lidas, sem o cabeçalho
   * @example 120
   */
  totalLinhas: number;
  /**
   * Lotes válidos, que serão (ou foram) criados
   * @example 118
   */
  lotes: number;
  /** @example 1 */
  loteamentosNovos: number;
  /** @example 4 */
  quadrasNovas: number;
  /** Linhas com problema; com qualquer erro, nada é gravado */
  erros: ErroImportacaoDto[];
}
