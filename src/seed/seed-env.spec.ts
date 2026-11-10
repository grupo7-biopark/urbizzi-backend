import { parseSeedEnv } from './seed-env.js';
const env = {
  DATABASE_URL: 'postgresql://teste:teste@localhost/teste',
  SEED_ADMIN_EMAIL: ' ADMIN@EXEMPLO.COM ',
  SEED_ADMIN_SENHA: 'SenhaFicticia123!',
};
describe('Ambiente do seed', () => {
  it('normaliza e-mail e usa nome padrão sem exigir configuração da API', () => {
    expect(parseSeedEnv(env)).toMatchObject({
      SEED_ADMIN_EMAIL: 'admin@exemplo.com',
      SEED_ADMIN_NOME: 'Administrador',
      development: false,
    });
  });
  it.each(['DATABASE_URL', 'SEED_ADMIN_EMAIL', 'SEED_ADMIN_SENHA'])(
    'exige %s sem imprimir valores',
    (campo) => {
      const entrada = {
        ...env,
        [campo]:
          campo === 'SEED_ADMIN_EMAIL'
            ? 'segredo-invalido'
            : campo === 'SEED_ADMIN_SENHA'
              ? 'curta'
              : 'valor-secreto',
      };
      expect(() => parseSeedEnv(entrada)).toThrow(campo);
      try {
        parseSeedEnv(entrada);
      } catch (error) {
        expect((error as Error).message).not.toContain('valor-secreto');
        expect((error as Error).message).not.toContain('segredo-invalido');
      }
    },
  );
  it.each(['production', 'test', undefined])(
    'bloqueia exemplos com NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() =>
        parseSeedEnv(
          { ...env, NODE_ENV, SEED_DEV_SENHA: 'SenhaFicticiaDev123!' },
          true,
        ),
      ).toThrow('NODE_ENV=development');
    },
  );
  it('exige senha dos exemplos e permite desenvolvimento explícito', () => {
    expect(() =>
      parseSeedEnv({ ...env, NODE_ENV: 'development' }, true),
    ).toThrow('SEED_DEV_SENHA');
    expect(
      parseSeedEnv(
        {
          ...env,
          NODE_ENV: 'development',
          SEED_DEV_SENHA: 'SenhaFicticiaDev123!',
        },
        true,
      ).development,
    ).toBe(true);
  });
});
