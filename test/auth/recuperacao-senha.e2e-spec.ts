import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { EMAIL } from '../../src/shared/application/email/email.interface.js';
import { TokenRecuperacaoSenha } from '../../src/modules/auth/domain/models/token-recuperacao-senha.entity.js';
import { limparBanco } from '../helpers/database.js';
describe('Recuperação de senha (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarioId: string;
  let token: string;
  const credenciais = {
    email: 'recuperacao@exemplo.com',
    senha: 'SenhaAntiga123!',
  };
  const email = { enviarRecuperacao: vi.fn() };
  beforeEach(async () => {
    email.enviarRecuperacao
      .mockReset()
      .mockImplementation(async (_destinatario: string, recebido: string) => {
        token = recebido;
      });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL)
      .useValue(email)
      .compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    await limparBanco(prisma);
    const perfil = await prisma.perfil.create({
      data: { codigo: 'COMERCIAL', nome: 'Comercial' },
    });
    usuarioId = (
      await prisma.usuario.create({
        data: {
          nome: 'Teste',
          email: credenciais.email,
          senhaHash: await new Argon2PasswordHasher().hash(credenciais.senha),
          perfilId: perfil.id,
        },
      })
    ).id;
  });
  afterEach(async () => {
    await app?.close();
  });
  const solicitar = (email = credenciais.email) =>
    request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email });
  const redefinir = (valor = token) =>
    request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: valor, senha: 'NovaSenha123!' });
  it('executa fluxo completo, invalida senha antiga, recuperações e todos os refresh tokens', async () => {
    const sessoes = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post('/v1/auth/login')
          .send(credenciais)
          .expect(200),
      ),
    );
    await solicitar().expect(202);
    const outroToken = token;
    await solicitar().expect(202);
    const row = await prisma.tokenRecuperacaoSenha.findUniqueOrThrow({
      where: { tokenHash: TokenRecuperacaoSenha.hashToken(token) },
    });
    expect(row.tokenHash).not.toBe(token);
    expect(email.enviarRecuperacao).toHaveBeenCalledWith(
      credenciais.email,
      token,
    );
    await redefinir().expect(204);
    await redefinir().expect(401);
    await redefinir(outroToken).expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ ...credenciais, senha: 'NovaSenha123!' })
      .expect(200);
    for (const sessao of sessoes)
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: sessao.body.refreshToken })
        .expect(401);
  });
  it('rejeita token expirado sem alterar senha', async () => {
    await solicitar().expect(202);
    await prisma.tokenRecuperacaoSenha.updateMany({
      data: { expiraEm: new Date(0) },
    });
    const res = await redefinir().expect(401);
    expect(res.body.code).toBe('TOKEN_RECUPERACAO_INVALIDO');
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .expect(200);
  });
  it('permite somente um consumo concorrente do mesmo token', async () => {
    await solicitar().expect(202);
    const results = await Promise.all([redefinir(), redefinir()]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 401]);
  });
  it('responde igualmente para conta existente, inexistente, inativa e falha SMTP', async () => {
    const ativo = await solicitar(' RECUPERACAO@EXEMPLO.COM ').expect(202);
    const ausente = await solicitar('ausente@exemplo.com').expect(202);
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ativo: false },
    });
    const inativo = await solicitar().expect(202);
    expect(email.enviarRecuperacao).toHaveBeenCalledTimes(1);
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ativo: true },
    });
    email.enviarRecuperacao.mockRejectedValue(new Error('SMTP'));
    const falha = await solicitar().expect(202);
    for (const res of [ausente, inativo, falha]) {
      expect(res.text).toBe(ativo.text);
      expect(res.headers['cache-control']).toBe('no-store');
    }
  });
  it('valida entrada, rejeita desconhecido e limita tentativas', async () => {
    await solicitar('invalido').expect(400);
    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: 'curto', senha: '123' })
      .expect(400);
    await redefinir('a'.repeat(43)).expect(401);
    for (let i = 0; i < 4; i++)
      await solicitar('ausente@exemplo.com').expect(202);
    await solicitar().expect(429);
  });
  it('rejeita recuperação de usuário desativado depois do envio', async () => {
    await solicitar().expect(202);
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { ativo: false },
    });
    await redefinir().expect(401);
    expect(
      (await prisma.tokenRecuperacaoSenha.findFirstOrThrow()).usadoEm,
    ).toBeNull();
  });
  it('documenta recuperação pública e respostas no Swagger', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(
      doc.paths['/v1/auth/forgot-password'].post?.responses,
    ).toHaveProperty('202');
    expect(doc.paths['/v1/auth/reset-password'].post?.responses).toHaveProperty(
      '204',
    );
    expect(doc.paths['/v1/auth/reset-password'].post?.responses).toHaveProperty(
      '401',
    );
    expect(
      doc.paths['/v1/auth/forgot-password'].post?.security,
    ).toBeUndefined();
  });
  it('serializa redefinições concorrentes com links diferentes do mesmo usuário', async () => {
    await solicitar().expect(202);
    const anterior = token;
    await solicitar().expect(202);
    const results = await Promise.all([redefinir(anterior), redefinir(token)]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 401]);
  });
});
