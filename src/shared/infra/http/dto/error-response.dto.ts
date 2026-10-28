export class ErrorDetailDto {
  /**
   * Campo inválido (caminho com ponto para objetos aninhados)
   * @example 'nome'
   */
  field: string;

  /**
   * Mensagens de validação do campo
   * @example ['nome não deve ser vazio']
   */
  messages: string[];
}

/** Formato único de erro de toda a API. */
export class ErrorResponseDto {
  /** @example 404 */
  statusCode: number;

  /**
   * Código estável do erro, em UPPER_SNAKE_CASE
   * @example 'LOTE_NAO_ENCONTRADO'
   */
  code: string;

  /**
   * Mensagem legível, em português
   * @example 'Lote não encontrado'
   */
  message: string;

  /** Presente apenas em erros de validação (code DADOS_INVALIDOS) */
  details?: ErrorDetailDto[];

  /** @example '/v1/lotes/0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  path: string;

  /** @example '2026-10-28T12:00:00.000Z' */
  timestamp: string;
}
