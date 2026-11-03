import { Transform } from 'class-transformer';

/**
 * Remove os espaços das pontas de um campo texto do DTO. Com
 * `{ vazioComoNulo: true }`, texto vazio vira `null`, para campos opcionais
 * que podem ser limpos no PATCH. Valores que não são texto passam intactos e
 * são barrados pelos validadores do campo.
 */
export function Trim({ vazioComoNulo = false } = {}) {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const texto = value.trim();
    return vazioComoNulo && texto === '' ? null : texto;
  });
}
