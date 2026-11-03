import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/application/dto/pagination-query.dto.js';
import { Trim } from '../../../../shared/application/dto/trim.transform.js';

export class ListQuadrasQueryDto extends PaginationQueryDto {
  /**
   * Busca por parte do número (sem diferenciar maiúsculas)
   * @example 'a'
   */
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  q?: string;
}
