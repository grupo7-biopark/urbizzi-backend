import { Test } from '@nestjs/testing';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { limparBanco } from '../helpers/database.js';

@Controller('teste-protegido')
class RotaProtegidaController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let senhaHash: string;
  let usuarioId: string;
  const credenciais = { email: 'teste@exemplo.com', senha: 'SenhaTeste123!' };
  beforeAll(async () => {
    senhaHash = await new Argon2PasswordHasher().hash(credenciais.senha);
  });
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RotaProtegidaController],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await limparBanco(prisma);
    const perfil = await prisma.perfil.create({
      data: { codigo: 'COMERCIAL', nome: 'Comercial' },
    });
    const usuario = await prisma.usuario.create({
      data: {
        nome: 'Teste',
        email: credenciais.email,
        senhaHash,
        perfilId: perfil.id,
      },
    });
    usuarioId = usuario.id;
  });
  afterEach(async () => {
    await app?.close();
  });
  const login = () =>
    request(app.getHttpServer()).post('/v1/auth/login').send(credenciais);
  it('login válido retorna tokens, persiste apenas hash e permite consultar /me', async () => {
    const res = await login().expect(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect((await prisma.sessao.findFirstOrThrow()).tokenHash).not.toBe(
      res.body.refreshToken,
    );
    const me = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .auth(res.body.accessToken, { type: 'bearer' })
      .expect(200);
    expect(me.body).toEqual({
      id: usuarioId,
      nome: 'Teste',
      email: credenciais.email,
      perfil: 'COMERCIAL',
    });
  });
  it('não revela se o e-mail existe e nega usuário inativo', async () => {
    const errado = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ ...credenciais, senha: 'errada' })
      .expect(401);
    const ausente = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ ...credenciais, email: 'ausente@exemplo.com' })
      .expect(401);
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ativo: false },
    });
    const inativo = await login().expect(401);
    for (const res of [errado, ausente, inativo])
      expect(res.body).toMatchObject({
        code: 'CREDENCIAIS_INVALIDAS',
        message: 'E-mail ou senha inválidos',
      });
    expect(await prisma.sessao.count()).toBe(0);
  });
  it('valida corpo e normaliza e-mail', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ ...credenciais, email: ' TESTE@EXEMPLO.COM ' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'invalido', senha: '', extra: true })
      .expect(400);
    expect(res.body.code).toBe('DADOS_INVALIDOS');
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'curto' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .send({})
      .expect(400);
  });
  it('protege rotas e rejeita token expirado, assinatura errada e subject inválido', async () => {
    const jwt = app.get(JwtService);
    const options = {
      secret: app.get(ConfigService).getOrThrow<string>('JWT_SECRET'),
      issuer: 'urbizzi',
      audience: 'urbizzi-api',
    };
    const { accessToken } = (await login().expect(200)).body;
    const expired = jwt.sign({ sub: usuarioId }, { ...options, expiresIn: -1 });
    const wrong = jwt.sign(
      { sub: usuarioId },
      { ...options, secret: 'outro-segredo', expiresIn: 900 },
    );
    const invalid = jwt.sign(
      { sub: 'invalido' },
      { ...options, expiresIn: 900 },
    );
    for (const token of [
      '',
      'invalido',
      expired,
      wrong,
      invalid,
      accessToken + 'x',
    ]) {
      const req = request(app.getHttpServer()).get('/v1/auth/me');
      if (token) req.auth(token, { type: 'bearer' });
      const res = await req.expect(401);
      expect(res.body.code).toBe('NAO_AUTENTICADO');
    }
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/v1/teste-protegido').expect(401);
    await request(app.getHttpServer())
      .get('/v1/teste-protegido')
      .auth(accessToken, { type: 'bearer' })
      .expect(200);
  });
  it('rotaciona refresh, rejeita reutilização e revoga por logout idempotente', async () => {
    const { refreshToken } = (await login().expect(200)).body;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    const reused = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    expect(reused.body.code).toBe('REFRESH_TOKEN_INVALIDO');
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refreshToken: res.body.refreshToken })
        .expect(204);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(401);
  });
  it('permite somente uma renovação concorrente do mesmo refresh token', async () => {
    const { refreshToken } = (await login().expect(200)).body;
    const results = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app.getHttpServer())
          .post('/v1/auth/refresh')
          .send({ refreshToken }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    expect(await prisma.sessao.count({ where: { revogadoEm: null } })).toBe(1);
  });
  it('nega refresh expirado ou desconhecido', async () => {
    const { refreshToken } = (await login().expect(200)).body;
    await prisma.sessao.updateMany({ data: { expiraEm: new Date(0) } });
    for (const token of [refreshToken, 'a'.repeat(43)])
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: token })
        .expect(401);
  });
  it('desativação invalida acesso e renovação já emitidos', async () => {
    const { accessToken, refreshToken } = (await login().expect(200)).body;
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ativo: false },
    });
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .auth(accessToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
  it('não usa perfil desatualizado do token', async () => {
    const { accessToken } = (await login().expect(200)).body;
    const perfil = await prisma.perfil.create({
      data: { codigo: 'CONSULTA', nome: 'Consulta' },
    });
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { perfilId: perfil.id },
    });
    const res = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .auth(accessToken, { type: 'bearer' })
      .expect(200);
    expect(res.body.perfil).toBe('CONSULTA');
  });
  it('limita login por IP inclusive credenciais corretas', async () => {
    for (let i = 0; i < 5; i++) await login().expect(200);
    const res = await login().expect(429);
    expect(res.body.code).toBe('MUITAS_REQUISICOES');
  });
  it('documenta rotas, autenticação e respostas no Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(doc.paths['/v1/auth/login'].post?.responses).toHaveProperty('429');
    expect(doc.paths['/v1/auth/me'].get?.security).toEqual([{ bearer: [] }]);
    expect(doc.paths['/v1/auth/logout'].post?.responses).toHaveProperty('204');
  });
});
