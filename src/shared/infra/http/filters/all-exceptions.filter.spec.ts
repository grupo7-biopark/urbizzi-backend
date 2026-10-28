import {
  ArgumentsHost,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '../../../../generated/prisma/client.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../domain/errors/domain.error.js';
import { validationExceptionFactory } from '../validation-exception.factory.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply, getRequestUrl: () => '/v1/lotes/1' },
  } as unknown as HttpAdapterHost);

  function catchAndGetBody(exception: unknown) {
    reply.mockClear();
    filter.catch(exception, host);
    const [, body, status] = reply.mock.calls[0];
    return { body, status };
  }

  it.each([
    [new NotFoundError('LOTE_NAO_ENCONTRADO', 'Lote não encontrado'), 404],
    [new ConflictError('LOTE_INDISPONIVEL', 'Lote indisponível'), 409],
    [new BusinessRuleError('RESERVA_EXPIRADA', 'Reserva expirada'), 422],
    [new ForbiddenError('RESERVA_DE_OUTRO_VENDEDOR', 'Sem permissão'), 403],
  ])('mapeia %s para HTTP %i mantendo code e message', (error, status) => {
    const { body, status: replied } = catchAndGetBody(error);

    expect(replied).toBe(status);
    expect(body).toEqual({
      statusCode: status,
      code: error.code,
      message: error.message,
      path: '/v1/lotes/1',
      timestamp: expect.any(String),
    });
  });

  it('usa code padrão para HttpException do Nest', () => {
    const { body } = catchAndGetBody(new ForbiddenException());
    expect(body).toMatchObject({ statusCode: 403, code: 'ACESSO_NEGADO' });
  });

  it('preserva a mensagem de HttpException com string', () => {
    const { body } = catchAndGetBody(new NotFoundException('Cannot GET /x'));
    expect(body).toMatchObject({
      statusCode: 404,
      code: 'RECURSO_NAO_ENCONTRADO',
      message: 'Cannot GET /x',
    });
  });

  it('repassa details de erros de validação', () => {
    const { body } = catchAndGetBody(
      validationExceptionFactory([
        { property: 'nome', constraints: { isString: 'nome inválido' } },
      ]),
    );
    expect(body).toMatchObject({
      statusCode: 400,
      code: 'DADOS_INVALIDOS',
      details: [{ field: 'nome', messages: ['nome inválido'] }],
    });
  });

  it('converte violação de unicidade do Prisma (P2002) em 409', () => {
    const error = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: '7.10.1',
    });
    const { body } = catchAndGetBody(error);
    expect(body).toMatchObject({ statusCode: 409, code: 'REGISTRO_DUPLICADO' });
  });

  it('não vaza detalhes de erros desconhecidos', () => {
    const { body } = catchAndGetBody(new Error('senha do banco: 123'));
    expect(body).toMatchObject({
      statusCode: 500,
      code: 'ERRO_INTERNO',
      message: 'Erro interno do servidor',
    });
  });
});
