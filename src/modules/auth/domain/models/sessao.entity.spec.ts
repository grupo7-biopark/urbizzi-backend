import { Sessao } from './sessao.entity.js';
describe('Sessao', () => {
  it('gera token aleatório e guarda somente o hash', () => {
    const { sessao, token } = Sessao.create('usuario', 3600);
    expect(token).toHaveLength(43);
    expect(sessao.tokenHash).toBe(Sessao.hashToken(token));
    expect(sessao.tokenHash).not.toBe(token);
    expect(sessao.usuarioId).toBe('usuario');
    expect(sessao.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessao.expiraEm.getTime()).toBeGreaterThan(Date.now() + 3599000);
    expect(Sessao.create('usuario', 3600).token).not.toBe(token);
  });
  it('restaura registro e protege a data', () => {
    const props = {
      id: 'id',
      usuarioId: 'u',
      tokenHash: 'hash',
      expiraEm: new Date(),
    };
    const sessao = Sessao.restore(props);
    sessao.expiraEm.setFullYear(2000);
    expect(sessao.expiraEm).toEqual(props.expiraEm);
    expect(sessao.id).toBe('id');
  });
});
