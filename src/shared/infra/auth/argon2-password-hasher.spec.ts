import { Argon2PasswordHasher } from './argon2-password-hasher.js';
describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();
  it('gera hash argon2id com salt e verifica a senha', async () => {
    const hash = await hasher.hash('SenhaTeste123!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await hasher.hash('SenhaTeste123!')).not.toBe(hash);
    expect(await hasher.verify(hash, 'SenhaTeste123!')).toBe(true);
    expect(await hasher.verify(hash, 'incorreta')).toBe(false);
  });
  it('rejeita hash inválido', async () => {
    expect(await hasher.verify('invalido', 'senha')).toBe(false);
  });
});
