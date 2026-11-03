import { PrismaSessaoRepository } from '../../src/modules/auth/infra/repositories/prisma-sessao.repository.js';
import { PrismaRecuperacaoSenhaRepository } from '../../src/modules/auth/infra/repositories/prisma-recuperacao-senha.repository.js';
import { SESSAO_REPOSITORY } from '../../src/modules/auth/domain/repositories/sessao.repository.interface.js';
import { RECUPERACAO_SENHA_REPOSITORY } from '../../src/modules/auth/domain/repositories/recuperacao-senha.repository.interface.js';
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
    vi.restoreAllMocks();
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

  function barreira() {
    let resolver!: () => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    return { promise, liberar: () => resolver() };
  }
  async function aguardarBloqueioUsuario(quantidade = 1) {
    const limite = Date.now() + 3000;
    while (Date.now() < limite) {
      const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query ILIKE '%usuarios%'
      `;
      if (total >= quantidade) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('A operação não aguardou o bloqueio do usuário');
  }
  it('revoga a sessão criada por refresh que começou antes da redefinição', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .expect(200);
    await solicitar().expect(202);
    const repository = app.get<PrismaSessaoRepository>(SESSAO_REPOSITORY);
    const original = repository.rotate.bind(repository);
    const entrou = barreira();
    const continuar = barreira();
    vi.spyOn(repository, 'rotate').mockImplementation(async (...args) => {
      const resultado = await original(...args);
      entrou.liberar();
      await continuar.promise;
      return resultado;
    });
    const refresh = request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .then((r) => r);
    await entrou.promise;
    const reset = redefinir().then((r) => r);
    try {
      await aguardarBloqueioUsuario();
    } finally {
      continuar.liberar();
    }
    const [renovacao, redefinicao] = await Promise.all([refresh, reset]);
    expect(renovacao.status).toBe(200);
    expect(redefinicao.status).toBe(204);
    expect(
      await prisma.sessao.count({ where: { usuarioId, revogadoEm: null } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: renovacao.body.refreshToken })
      .expect(401);
  });
  it('revoga a sessão do login com senha antiga que começou antes da redefinição', async () => {
    await solicitar().expect(202);
    const repository = app.get<PrismaSessaoRepository>(SESSAO_REPOSITORY);
    const original = repository.create.bind(repository);
    const entrou = barreira();
    const continuar = barreira();
    vi.spyOn(repository, 'create').mockImplementation(async (...args) => {
      await original(...args);
      entrou.liberar();
      await continuar.promise;
    });
    const login = request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .then((r) => r);
    await entrou.promise;
    const reset = redefinir().then((r) => r);
    try {
      await aguardarBloqueioUsuario();
    } finally {
      continuar.liberar();
    }
    const [autenticacao, redefinicao] = await Promise.all([login, reset]);
    expect(autenticacao.status).toBe(200);
    expect(redefinicao.status).toBe(204);
    expect(
      await prisma.sessao.count({ where: { usuarioId, revogadoEm: null } }),
    ).toBe(0);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: autenticacao.body.refreshToken })
      .expect(401);
  });
  it('nega login antigo e refresh quando a redefinição obtém o bloqueio primeiro', async () => {
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .expect(200);
    await solicitar().expect(202);
    const repository = app.get<PrismaRecuperacaoSenhaRepository>(
      RECUPERACAO_SENHA_REPOSITORY,
    );
    const original = repository.invalidarTodos.bind(repository);
    const entrou = barreira();
    const continuar = barreira();
    vi.spyOn(repository, 'invalidarTodos').mockImplementation(
      async (...args) => {
        await original(...args);
        entrou.liberar();
        await continuar.promise;
      },
    );
    const reset = redefinir().then((r) => r);
    await entrou.promise;
    const refresh = request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .then((r) => r);
    const antigo = request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(credenciais)
      .then((r) => r);
    try {
      await aguardarBloqueioUsuario(2);
    } finally {
      continuar.liberar();
    }
    const results = await Promise.all([reset, refresh, antigo]);
    expect(results.map((r) => r.status)).toEqual([204, 401, 401]);
    expect(
      await prisma.sessao.count({ where: { usuarioId, revogadoEm: null } }),
    ).toBe(0);
  });
});
