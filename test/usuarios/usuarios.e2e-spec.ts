import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppTeste } from '../helpers/feature-test.js';
import { criarUsuarios, type UsuariosTeste } from '../helpers/usuarios.js';
import { limparBanco } from '../helpers/database.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { AuditoriaService } from '../../src/modules/auditoria/application/services/auditoria.service.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
describe('Gestão de usuários (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarios: UsuariosTeste;
  const novo = {
    nome: 'Nova Pessoa',
    email: ' NOVA@EXEMPLO.COM ',
    perfil: 'COMERCIAL',
    senha: 'SenhaInicial123!',
  };
  beforeEach(async () => {
    app = await criarAppTeste();
    prisma = app.get(PrismaService);
    await limparBanco(prisma);
    usuarios = await criarUsuarios(app);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app?.close();
  });
  const admin = () => usuarios.ADMINISTRADOR.token;
  const criar = () =>
    request(app.getHttpServer())
      .post('/v1/usuarios')
      .auth(admin(), { type: 'bearer' })
      .send(novo);
  it('cria, consulta, filtra, edita perfil, desativa e reativa com auditoria', async () => {
    const created = await criar().expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({
      email: 'nova@exemplo.com',
      ativo: true,
    });
    expect(created.body).not.toHaveProperty('senhaHash');
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nova@exemplo.com', senha: novo.senha })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/usuarios/${id}`)
      .auth(admin(), { type: 'bearer' })
      .expect(200);
    const page = await request(app.getHttpServer())
      .get('/v1/usuarios?perfil=COMERCIAL&ativo=true&pageSize=1')
      .auth(admin(), { type: 'bearer' })
      .expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.total).toBe(2);
    await request(app.getHttpServer())
      .patch(`/v1/usuarios/${id}`)
      .auth(admin(), { type: 'bearer' })
      .send({ perfil: 'GESTOR', nome: 'Outro Nome' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/usuarios/${id}/desativar`)
      .auth(admin(), { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'nova@exemplo.com', senha: novo.senha })
      .expect(401);
    const inactive = await request(app.getHttpServer())
      .get('/v1/usuarios?ativo=false')
      .auth(admin(), { type: 'bearer' })
      .expect(200);
    expect(inactive.body.meta.total).toBe(1);
    await request(app.getHttpServer())
      .post(`/v1/usuarios/${id}/ativar`)
      .auth(admin(), { type: 'bearer' })
      .expect(200);
    const entries = await prisma.historicoAuditoria.findMany({
      where: { entidadeId: id },
    });
    expect(entries.map((e) => e.acao).sort()).toEqual([
      'ALTERAR',
      'ATIVAR',
      'CRIAR',
      'DESATIVAR',
    ]);
    expect(JSON.stringify(entries)).not.toContain('nova@exemplo.com');
    expect(JSON.stringify(entries)).not.toContain(novo.senha);
  });
  it('rejeita e-mail duplicado normalizado na criação e edição', async () => {
    await criar().expect(201);
    await criar().expect(409);
    await request(app.getHttpServer())
      .patch(`/v1/usuarios/${usuarios.COMERCIAL.id}`)
      .auth(admin(), { type: 'bearer' })
      .send({ email: 'NOVA@EXEMPLO.COM' })
      .expect(409);
  });
  it.each(['GESTOR', 'COMERCIAL', 'CONSULTA'] as const)(
    'nega todos os endpoints para %s',
    async (perfil) => {
      for (const [method, path] of [
        ['get', ''],
        ['post', ''],
        ['get', `/${usuarios.COMERCIAL.id}`],
        ['patch', `/${usuarios.COMERCIAL.id}`],
        ['post', `/${usuarios.COMERCIAL.id}/ativar`],
        ['post', `/${usuarios.COMERCIAL.id}/desativar`],
      ] as const) {
        await request(app.getHttpServer())
          [method]('/v1/usuarios' + path)
          .auth(usuarios[perfil].token, { type: 'bearer' })
          .send(novo)
          .expect(403);
      }
    },
  );
  it('exige autenticação e valida filtros e corpo sem aceitar null ou senha na edição', async () => {
    await request(app.getHttpServer()).get('/v1/usuarios').expect(401);
    for (const query of ['ativo=abc', 'perfil=INVALIDO', 'page=0'])
      await request(app.getHttpServer())
        .get('/v1/usuarios?' + query)
        .auth(admin(), { type: 'bearer' })
        .expect(400);
    for (const body of [
      { nome: null },
      { email: null },
      { perfil: null },
      { senha: 'OutraSenha123!' },
    ])
      await request(app.getHttpServer())
        .patch(`/v1/usuarios/${usuarios.COMERCIAL.id}`)
        .auth(admin(), { type: 'bearer' })
        .send(body)
        .expect(400);
  });
  it('protege último administrador contra desativação e rebaixamento', async () => {
    for (const [method, path, body] of [
      ['post', `/${usuarios.ADMINISTRADOR.id}/desativar`, {}],
      ['patch', `/${usuarios.ADMINISTRADOR.id}`, { perfil: 'GESTOR' }],
    ] as const) {
      const res = await request(app.getHttpServer())
        [method]('/v1/usuarios' + path)
        .auth(admin(), { type: 'bearer' })
        .send(body)
        .expect(409);
      expect(res.body.code).toBe('ULTIMO_ADMINISTRADOR');
    }
  });
  it('preserva um administrador em rebaixamentos concorrentes', async () => {
    await request(app.getHttpServer())
      .patch(`/v1/usuarios/${usuarios.GESTOR.id}`)
      .auth(admin(), { type: 'bearer' })
      .send({ perfil: 'ADMINISTRADOR' })
      .expect(200);
    const results = await Promise.all(
      [usuarios.ADMINISTRADOR.id, usuarios.GESTOR.id].map((id) =>
        request(app.getHttpServer())
          .patch(`/v1/usuarios/${id}`)
          .auth(
            id === usuarios.ADMINISTRADOR.id ? admin() : usuarios.GESTOR.token,
            { type: 'bearer' },
          )
          .send({ perfil: 'CONSULTA' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.usuario.count({
        where: { ativo: true, perfil: { codigo: 'ADMINISTRADOR' } },
      }),
    ).toBe(1);
  });
  it('reverte criação quando auditoria falha', async () => {
    vi.spyOn(app.get(AuditoriaService), 'registrar').mockRejectedValue(
      new Error('falha simulada'),
    );
    await criar().expect(500);
    expect(
      await prisma.usuario.count({ where: { email: 'nova@exemplo.com' } }),
    ).toBe(0);
  });
  it('retorna 404 e documenta as rotas', async () => {
    await request(app.getHttpServer())
      .get('/v1/usuarios/00000000-0000-4000-8000-000000000000')
      .auth(admin(), { type: 'bearer' })
      .expect(404);
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().addBearerAuth().build(),
    );
    expect(doc.paths['/v1/usuarios'].get?.responses).toHaveProperty('403');
  });

  it('retorna perfil não encontrado se o código válido ainda não foi cadastrado', async () => {
    const papel = await prisma.perfil.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    await prisma.usuario.update({
      where: { id: usuarios.CONSULTA.id },
      data: { perfilId: papel.id },
    });
    await prisma.perfil.delete({ where: { codigo: 'CONSULTA' } });
    const response = await request(app.getHttpServer())
      .post('/v1/usuarios')
      .auth(admin(), { type: 'bearer' })
      .send({ ...novo, perfil: 'CONSULTA' })
      .expect(404);
    expect(response.body.code).toBe('PERFIL_NAO_ENCONTRADO');
    expect(
      await prisma.usuario.count({ where: { email: 'nova@exemplo.com' } }),
    ).toBe(0);
  });
});
