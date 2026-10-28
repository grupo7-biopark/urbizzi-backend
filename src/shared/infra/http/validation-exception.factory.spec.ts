import type { ValidationError } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception.factory.js';

describe('validationExceptionFactory', () => {
  it('gera DADOS_INVALIDOS com os campos aninhados achatados', () => {
    const errors: ValidationError[] = [
      {
        property: 'nome',
        constraints: { isNotEmpty: 'nome não deve ser vazio' },
      },
      {
        property: 'endereco',
        children: [
          { property: 'cep', constraints: { isPostalCode: 'cep inválido' } },
        ],
      },
    ];

    const exception = validationExceptionFactory(errors);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toEqual({
      code: 'DADOS_INVALIDOS',
      message: 'Os dados enviados são inválidos',
      details: [
        { field: 'nome', messages: ['nome não deve ser vazio'] },
        { field: 'endereco.cep', messages: ['cep inválido'] },
      ],
    });
  });
});
