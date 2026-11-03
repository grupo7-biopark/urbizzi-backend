import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/**
 * Valida um decimal maior que zero com até `digitosInteiros` dígitos antes da
 * vírgula e até 2 casas decimais, no formato da API (`"250000.00"`). Aceita
 * também número no JSON, convertido para string antes da validação, para o
 * valor seguir como texto até o Prisma sem passar por ponto flutuante.
 */
export function DecimalPositivo(digitosInteiros: number): PropertyDecorator {
  const formato = new RegExp(
    `^(?!0+(?:\\.0+)?$)\\d{1,${digitosInteiros}}(?:\\.\\d{1,2})?$`,
  );
  const transform = Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' ? String(value) : value,
  );
  const matches = Matches(formato, {
    message: ({ property }) =>
      `${property} deve ser um número positivo com até ${digitosInteiros} dígitos inteiros e 2 casas decimais`,
  });
  return (target, propertyKey) => {
    transform(target, propertyKey);
    matches(target, propertyKey);
  };
}
