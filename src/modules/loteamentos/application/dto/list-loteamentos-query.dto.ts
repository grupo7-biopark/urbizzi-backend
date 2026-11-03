import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class ListLoteamentosQueryDto extends PaginationQueryDto {
  /**
   * Busca por parte do nome (sem diferenciar maiúsculas)
   * @example 'bela'
   */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string;
}
