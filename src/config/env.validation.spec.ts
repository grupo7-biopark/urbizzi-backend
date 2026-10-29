import { validate } from './env.validation.js';

describe('validate (env)', () => {
  const validEnv = {
    S3_ACCESS_KEY_ID: 'chave-teste',
    S3_SECRET_ACCESS_KEY: 'segredo-ficticio',
    JWT_SECRET: 'segredo-ficticio-de-testes-com-32-caracteres',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/urbizzi?schema=public',
  };

  it('aplica valores padrão quando variáveis opcionais estão ausentes', () => {
    expect(validate(validEnv)).toEqual({
      S3_ENDPOINT: 'http://localhost:3900',
      S3_REGION: 'garage',
      S3_FORCE_PATH_STYLE: true,
      S3_ACCESS_KEY_ID: validEnv.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: validEnv.S3_SECRET_ACCESS_KEY,
      S3_BUCKET_ORIGINAIS: 'plantas-originais',
      S3_BUCKET_TILES: 'plantas-tiles',
      S3_URL_EXPIRES_IN: 900,
      JWT_SECRET: validEnv.JWT_SECRET,
      JWT_EXPIRES_IN: 900,
      REFRESH_TOKEN_EXPIRES_IN: 604800,
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: validEnv.DATABASE_URL,
    });
  });

  it.each([
    { S3_ACCESS_KEY_ID: '' },
    { S3_SECRET_ACCESS_KEY: '' },
    { S3_ENDPOINT: 'ftp://exemplo.com' },
    { S3_ENDPOINT: 'https://user:secret@exemplo.com' },
    { S3_FORCE_PATH_STYLE: 'sim' },
    { S3_URL_EXPIRES_IN: 604801 },
  ])('rejeita configuração S3 inválida %j', (override) => {
    expect(() => validate({ ...validEnv, ...override })).toThrow();
  });

  it.each([
    { JWT_SECRET: 'curto' },
    { JWT_EXPIRES_IN: 0 },
    { REFRESH_TOKEN_EXPIRES_IN: -1 },
  ])('rejeita configuração de token inválida %j', (config) => {
    expect(() => validate({ ...validEnv, ...config })).toThrow();
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
