/**
 * Erros de negócio lançados pelas camadas domain e application.
 *
 * Não dependem do NestJS: o AllExceptionsFilter traduz cada classe para o
 * status HTTP correspondente. `code` é um identificador estável em
 * UPPER_SNAKE_CASE (ex.: LOTE_NAO_ENCONTRADO) que o front-end pode tratar.
 */
export abstract class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Recurso inexistente ou fora do alcance do usuário. HTTP 404. */
export class NotFoundError extends DomainError {}

/** Conflito com o estado atual do recurso (ex.: lote já reservado). HTTP 409. */
export class ConflictError extends DomainError {}

/** Entrada válida, mas que viola uma regra de negócio. HTTP 422. */
export class BusinessRuleError extends DomainError {}

/** Usuário autenticado sem permissão para a ação/recurso. HTTP 403. */
export class ForbiddenError extends DomainError {}
