import { TokenRecuperacaoSenha } from './token-recuperacao-senha.entity.js';
describe('TokenRecuperacaoSenha', () => {
  afterEach(() => vi.useRealTimers());
  it('gera tokens imprevisíveis e guarda somente hash com validade de uma hora', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    const a = TokenRecuperacaoSenha.create('usuario');
    const b = TokenRecuperacaoSenha.create('usuario');
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.entidade.id).not.toBe(b.entidade.id);
    expect(a.entidade.usuarioId).toBe('usuario');
    expect(a.entidade.tokenHash).toBe(TokenRecuperacaoSenha.hashToken(a.token));
    expect(a.entidade.tokenHash).toHaveLength(64);
    expect(a.entidade.tokenHash).not.toBe(a.token);
    expect(a.entidade.expiraEm.toISOString()).toBe('2026-11-01T13:00:00.000Z');
    expect(a.entidade.isValido()).toBe(true);
    vi.advanceTimersByTime(3600000);
    expect(a.entidade.isValido()).toBe(false);
  });
  it('rejeita token usado mesmo antes de expirar', () => {
    const entidade = TokenRecuperacaoSenha.restore({
      id: 'id',
      usuarioId: 'usuario',
      tokenHash: 'hash',
      expiraEm: new Date(Date.now() + 60000),
      usadoEm: new Date(),
    });
    expect(entidade.isValido()).toBe(false);
  });
});
