import { IsIn, IsOptional } from 'class-validator';
import type { FormatoPlanilha } from '../../domain/repositories/planilha.interface.js';

export class ModeloImportacaoQueryDto {
  /**
   * Formato do modelo (padrão `xlsx`)
   * @example 'xlsx'
   */
  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  formato: FormatoPlanilha = 'xlsx';
}
