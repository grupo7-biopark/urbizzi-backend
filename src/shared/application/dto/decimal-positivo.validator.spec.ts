import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DecimalPositivo } from './decimal-positivo.validator.js';

class ExemploDto {
  @DecimalPositivo(3)
  valor: unknown;
}

async function erros(valor: unknown): Promise<string[]> {
  const dto = plainToInstance(ExemploDto, { valor });
  const result = await validate(dto);
  return result.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('DecimalPositivo', () => {
  it.each(['1', '360', '999.99', '0.5', '10.10', 360.5, 12])(
    'aceita %s',
    async (valor) => {
      expect(await erros(valor)).toEqual([]);
    },
  );

  it.each(['0', '0.00', '-1', '1000', '1.234', '1,50', 'abc', '', 0, -5, null])(
    'rejeita %s',
    async (valor) => {
      expect(await erros(valor)).toEqual([
        'valor deve ser um número positivo com até 3 dígitos inteiros e 2 casas decimais',
      ]);
    },
  );

  it('converte número em texto', () => {
    const dto = plainToInstance(ExemploDto, { valor: 360.5 });

    expect(dto.valor).toBe('360.5');
  });
});
