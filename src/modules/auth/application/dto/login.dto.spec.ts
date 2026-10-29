import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto.js';
import { RefreshTokenDto } from './refresh-token.dto.js';
describe('DTOs de autenticação', () => {
  it('normaliza e-mail', async () => {
    const dto = plainToInstance(LoginDto, {
      email: ' TESTE@EXEMPLO.COM ',
      senha: 'senha',
    });
    expect(dto.email).toBe('teste@exemplo.com');
    expect(await validate(dto)).toEqual([]);
  });
  it.each([
    { email: 123, senha: 'senha' },
    { email: 'invalido', senha: '' },
    { email: 'teste@exemplo.com', senha: 's'.repeat(1025) },
  ])('rejeita login inválido', async (input) => {
    expect(
      (await validate(plainToInstance(LoginDto, input))).length,
    ).toBeGreaterThan(0);
  });
  it('valida refresh token opaco', async () => {
    expect(
      await validate(
        plainToInstance(RefreshTokenDto, { refreshToken: 'a'.repeat(43) }),
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(RefreshTokenDto, { refreshToken: 'curto' }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
