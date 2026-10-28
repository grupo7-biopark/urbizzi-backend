import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

const DESCRIPTIONS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Dados inválidos (code DADOS_INVALIDOS)',
  [HttpStatus.UNAUTHORIZED]: 'Token ausente ou inválido',
  [HttpStatus.FORBIDDEN]: 'Perfil sem permissão para a ação',
  [HttpStatus.NOT_FOUND]: 'Recurso não encontrado',
  [HttpStatus.CONFLICT]: 'Conflito com o estado atual do recurso',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Regra de negócio violada',
};

/**
 * Documenta no Swagger as respostas de erro de uma rota, todas no formato
 * ErrorResponseDto. Ex.: `@ApiErrorResponses(400, 404, 409)`.
 */
export function ApiErrorResponses(...statuses: HttpStatus[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  );
}
