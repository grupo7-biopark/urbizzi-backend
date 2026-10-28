import { BadRequestException, ValidationError } from '@nestjs/common';
import type { ErrorDetailDto } from './dto/error-response.dto.js';

/** exceptionFactory do ValidationPipe global: gera o erro DADOS_INVALIDOS. */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    code: 'DADOS_INVALIDOS',
    message: 'Os dados enviados são inválidos',
    details: flatten(errors),
  });
}

function flatten(errors: ValidationError[], parent?: string): ErrorDetailDto[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own: ErrorDetailDto[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}
