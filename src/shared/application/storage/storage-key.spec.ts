import { assertStorageKey, createStorageKey } from './storage-key.js';
describe('Chaves de armazenamento', () => {
  it('gera identificador opaco e normaliza extensão e prefixo', () => {
    const key = createStorageKey('plantas/id///', '.PDF');
    expect(key).toMatch(/^plantas\/id\/[0-9a-f-]{36}\.pdf$/);
    expect(createStorageKey('plantas/id', 'pdf')).not.toBe(key);
    expect(createStorageKey('', 'png')).toMatch(/^[0-9a-f-]{36}\.png$/);
  });
  it.each([
    '',
    '../segredo',
    'p/../q',
    './a',
    '/absoluto',
    'p\\q',
    'a\n',
    'x'.repeat(1025),
  ])('rejeita chave inválida %j sem expor seu valor', (key) => {
    expect(() => assertStorageKey(key)).toThrow('Chave de arquivo inválida');
  });
  it.each(['', '..', 'pdf/segredo', 'nome.pdf', 'extensaodemais'])(
    'rejeita extensão inválida',
    (ext) => {
      expect(() => createStorageKey('plantas', ext)).toThrow(
        'Extensão de arquivo inválida',
      );
    },
  );
  it('aceita prefixo vazio para listagem e chaves com caracteres escapados em URLs', () => {
    expect(() => assertStorageKey('', true)).not.toThrow();
    expect(() => assertStorageKey('p/área #1%.png')).not.toThrow();
  });
});
