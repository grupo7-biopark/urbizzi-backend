import { validate } from './env.validation.js';

describe('validate (env)', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/urbizzi?schema=public',
  };

  it('aplica valores padrão quando variáveis opcionais estão ausentes', () => {
    expect(validate(validEnv)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validEnv.DATABASE_URL,
    });
  });

  it('converte PORT para número', () => {
    expect(validate({ ...validEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it('lança erro quando DATABASE_URL está ausente', () => {
    expect(() => validate({})).toThrow(
      /DATABASE_URL: variável obrigatória não definida/,
    );
  });

  it('lança erro quando DATABASE_URL não é PostgreSQL', () => {
    expect(() => validate({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('lança erro quando NODE_ENV é inválido', () => {
    expect(() => validate({ ...validEnv, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });
});
