import { LinkPublico } from './link-publico.entity.js';
describe('LinkPublico', () => {
  it('gera tokens opacos, únicos e com 32 bytes', () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => LinkPublico.create('u').dados.token),
    );
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    }
  });
  it('preserva escopo e criador, restaura e desativa', () => {
    const link = LinkPublico.create('u', 'loteamento');
    expect(link.dados).toMatchObject({
      criadoPorId: 'u',
      loteamentoId: 'loteamento',
      ativo: true,
      acessos: 0,
    });
    const restored = LinkPublico.restore(link.dados);
    restored.desativar();
    expect(restored.dados.ativo).toBe(false);
    expect(link.dados.ativo).toBe(true);
  });
});
