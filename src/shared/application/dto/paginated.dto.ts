import type { Page, Pagination } from '../../domain/pagination.js';

export class PaginationMetaDto {
  /** @example 1 */
  page: number;
  /** @example 20 */
  pageSize: number;
  /** @example 57 */
  total: number;
  /** @example 3 */
  totalPages: number;
}

/**
 * Envelope de toda resposta de listagem: `{ data, meta }`.
 * No controller, documente com `@ApiPaginatedResponse(ItemDto)`.
 */
export class PaginatedDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  static of<T>(
    page: Page<T>,
    { page: current, pageSize }: Pagination,
  ): PaginatedDto<T> {
    const dto = new PaginatedDto<T>();
    dto.data = page.items;
    dto.meta = {
      page: current,
      pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / pageSize),
    };
    return dto;
  }
}
