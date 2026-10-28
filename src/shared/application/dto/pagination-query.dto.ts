import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { Pagination } from '../../domain/pagination.js';

/**
 * Query string padrão de listagens. DTOs de filtro de cada módulo estendem
 * esta classe (ex.: `class ListLotesQueryDto extends PaginationQueryDto`).
 */
export class PaginationQueryDto implements Pagination {
  /**
   * Página desejada, começando em 1
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /**
   * Itens por página (máximo 100)
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
