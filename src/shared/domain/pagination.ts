/** Parâmetros de paginação recebidos pelos repositórios. */
export interface Pagination {
  page: number;
  pageSize: number;
}

/** Resultado paginado devolvido pelos repositórios. */
export interface Page<T> {
  items: T[];
  total: number;
}

/** Converte page/pageSize em offset/limit (skip/take do Prisma). */
export function toSkipTake({ page, pageSize }: Pagination): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
