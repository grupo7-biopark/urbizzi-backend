import { documentoValido, normalizarDocumento } from './documento.js';
describe('Documentos de cliente', () => {
  it.each([
    '529.982.247-25',
    '11144477735',
    '04.252.011/0001-10',
    '11222333000181',
  ])('valida documento %s', (documento) => {
    expect(documentoValido(documento)).toBe(true);
  });
  it.each([
    '11111111111',
    '00000000000000',
    '52998224724',
    '52998224715',
    '04252011000111',
    '04252011000100',
    'abc52998224725',
    '123',
  ])('nega documento %s', (documento) => {
    expect(documentoValido(documento)).toBe(false);
  });
  it('normaliza formatação sem aceitar letras', () => {
    expect(normalizarDocumento(' 04.252.011/0001-10 ')).toBe('04252011000110');
  });
});
