import { PaginatedDto } from './paginated.dto.js';
import { toSkipTake } from '../../domain/pagination.js';

describe('PaginatedDto', () => {
  it('monta data e meta a partir de uma página', () => {
    const dto = PaginatedDto.of(
      { items: ['a', 'b'], total: 41 },
      { page: 2, pageSize: 20 },
    );

    expect(dto).toEqual({
      data: ['a', 'b'],
      meta: { page: 2, pageSize: 20, total: 41, totalPages: 3 },
    });
  });

  it('retorna totalPages 0 quando não há itens', () => {
    const dto = PaginatedDto.of(
      { items: [], total: 0 },
      { page: 1, pageSize: 20 },
    );
    expect(dto.meta.totalPages).toBe(0);
  });
});

describe('toSkipTake', () => {
  it('converte page/pageSize em skip/take', () => {
    expect(toSkipTake({ page: 3, pageSize: 10 })).toEqual({
      skip: 20,
      take: 10,
    });
  });
});
