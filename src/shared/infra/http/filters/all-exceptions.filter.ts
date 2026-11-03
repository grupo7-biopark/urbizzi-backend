import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  AuthenticationError,
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidInputError,
  NotFoundError,
} from '../../../domain/errors/domain.error.js';
import type {
  ErrorDetailDto,
  ErrorResponseDto,
} from '../dto/error-response.dto.js';

type ResolvedError = Pick<
  ErrorResponseDto,
  'statusCode' | 'code' | 'message' | 'details'
>;

const DOMAIN_ERROR_STATUS = new Map<Function, HttpStatus>([
  [InvalidInputError, HttpStatus.BAD_REQUEST],
  [AuthenticationError, HttpStatus.UNAUTHORIZED],
  [NotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [BusinessRuleError, HttpStatus.UNPROCESSABLE_ENTITY],
  [ForbiddenError, HttpStatus.FORBIDDEN],
]);

const DEFAULT_HTTP_CODES: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'REQUISICAO_INVALIDA',
  [HttpStatus.UNAUTHORIZED]: 'NAO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'ACESSO_NEGADO',
  [HttpStatus.NOT_FOUND]: 'RECURSO_NAO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLITO',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'REGRA_DE_NEGOCIO_VIOLADA',
  [HttpStatus.TOO_MANY_REQUESTS]: 'MUITAS_REQUISICOES',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ARQUIVO_MUITO_GRANDE',
};

// Mensagens em português para exceções que o Nest gera em inglês (ex.: o
// limite de tamanho do upload, "File too large")
const DEFAULT_HTTP_MESSAGES: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.PAYLOAD_TOO_LARGE]:
    'O arquivo enviado excede o tamanho máximo permitido',
};

/**
 * Converte qualquer exceção no formato padrão ErrorResponseDto
 * (ver docs/api-standards.md).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const error = this.resolve(exception);

    if (error.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseDto = {
      ...error,
      path: httpAdapter.getRequestUrl(ctx.getRequest()),
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(ctx.getResponse(), body, error.statusCode);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof DomainError) {
      return {
        statusCode:
          DOMAIN_ERROR_STATUS.get(exception.constructor) ??
          HttpStatus.UNPROCESSABLE_ENTITY,
        code: exception.code,
        message: exception.message,
        ...(exception instanceof InvalidInputError &&
          exception.details && { details: exception.details }),
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'REGISTRO_DUPLICADO',
          message: 'Já existe um registro com esses dados',
        };
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RECURSO_NAO_ENCONTRADO',
          message: 'Registro não encontrado',
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'ERRO_INTERNO',
      message: 'Erro interno do servidor',
    };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    const fallbackCode =
      DEFAULT_HTTP_CODES[statusCode as HttpStatus] ?? 'ERRO_HTTP';
    const defaultMessage = DEFAULT_HTTP_MESSAGES[statusCode as HttpStatus];
    if (defaultMessage) {
      return { statusCode, code: fallbackCode, message: defaultMessage };
    }

    if (typeof response === 'string') {
      return { statusCode, code: fallbackCode, message: response };
    }

    const { code, message, details } = response as {
      code?: string;
      message?: string | string[];
      details?: ErrorDetailDto[];
    };
    return {
      statusCode,
      code: code ?? fallbackCode,
      message: Array.isArray(message)
        ? message.join('; ')
        : (message ?? exception.message),
      ...(details && { details }),
    };
  }
}
