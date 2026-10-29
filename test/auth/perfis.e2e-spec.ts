import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Injectable,
  Param,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { AuthService } from '../../src/modules/auth/application/services/auth.service.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { Perfis } from '../../src/shared/infra/auth/perfis.decorator.js';
import { Public } from '../../src/shared/infra/auth/public.decorator.js';
import { CurrentUser } from '../../src/shared/infra/auth/current-user.decorator.js';
import { PropriedadePolicy } from '../../src/shared/domain/policies/propriedade.policy.js';
import type { UsuarioAutenticado } from '../../src/shared/domain/usuario-autenticado.js';
import { limparBanco } from '../helpers/database.js';

// Fixtures montadas somente nesta suíte, sem endpoints de exemplo na aplicação real.
@Injectable()
class ExemploPropriedadeService {
  alterar(usuario: UsuarioAutenticado, responsavelId: string) {
    PropriedadePolicy.assertPodeAlterar(usuario, responsavelId);
    return { ok: true };
  }
}
@Controller('teste-perfis')
@Perfis('GESTOR')
class ExemploPerfisController {
  constructor(private readonly propriedade: ExemploPropriedadeService) {}
  @Get('gestor')
  gestor() {
    return { ok: true };
  }
  @Get('admin')
  @Perfis('ADMINISTRADOR')
  admin() {
    return { ok: true };
  }
  @Get('cadastros')
  @Perfis('ADMINISTRADOR', 'GESTOR')
  cadastros() {
    return { ok: true };
  }
  @Get('clientes')
  @Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
  clientes() {
    return { ok: true };
  }
  @Get('mapa')
  @Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA')
  mapa() {
    return { ok: true };
  }
  @Get('bloqueado')
  @Perfis()
  bloqueado() {
    return { ok: true };
  }
  @Get('publico')
  @Public()
  publico() {
    return { ok: true };
  }
  @Get('propriedade/:responsavelId')
  @Perfis('ADMINISTRADOR', 'GESTOR', 'COMERCIAL')
  propriedadeRecurso(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('responsavelId') responsavelId: string,
  ) {
    return this.propriedade.alterar(usuario, responsavelId);
  }
}
@Controller('teste-autenticado')
class ExemploAutenticadoController {
  @Get()
  get() {
    return { ok: true };
  }
}

describe('Autorização por perfil e propriedade (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hash: string;
  const perfis = ['ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA'] as const;
  const usuarios = {} as Record<
    UsuarioAutenticado['perfil'],
    { id: string; token: string; perfilId: string }
  >;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ExemploPerfisController, ExemploAutenticadoController],
      providers: [ExemploPropriedadeService],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    hash = await new Argon2PasswordHasher().hash('SenhaTeste123!');
  });
  beforeEach(async () => {
    await limparBanco(prisma);
    for (const codigo of perfis) {
      const perfil = await prisma.perfil.create({
        data: { codigo, nome: codigo },
      });
      const email = `${codigo.toLowerCase()}@exemplo.com`;
      const usuario = await prisma.usuario.create({
        data: {
          nome: 'Usuário Teste',
          email,
          senhaHash: hash,
          perfilId: perfil.id,
        },
      });
      const tokens = await app
        .get(AuthService)
        .login({ email, senha: 'SenhaTeste123!' });
      usuarios[codigo] = {
        id: usuario.id,
        token: tokens.accessToken,
        perfilId: perfil.id,
      };
    }
  });
  afterAll(async () => {
    await app?.close();
  });
  it.each(perfis)('aplica a matriz de ações para %s', async (perfil) => {
    const regras = {
      gestor: ['GESTOR'],
      admin: ['ADMINISTRADOR'],
      cadastros: ['ADMINISTRADOR', 'GESTOR'],
      clientes: ['ADMINISTRADOR', 'GESTOR', 'COMERCIAL'],
      mapa: [...perfis],
      bloqueado: [],
    };
    for (const [rota, permitidos] of Object.entries(regras)) {
      const status = permitidos.includes(perfil) ? 200 : 403;
      const res = await request(app.getHttpServer())
        .get(`/v1/teste-perfis/${rota}`)
        .auth(usuarios[perfil].token, { type: 'bearer' })
        .expect(status);
      if (status === 403)
        expect(res.body).toMatchObject({
          statusCode: 403,
          code: 'ACESSO_NEGADO',
          message: 'Você não tem permissão para executar esta ação',
          path: `/v1/teste-perfis/${rota}`,
          timestamp: expect.any(String),
        });
    }
    await request(app.getHttpServer())
      .get('/v1/teste-autenticado')
      .auth(usuarios[perfil].token, { type: 'bearer' })
      .expect(200);
  });
  it('autentica antes de autorizar e preserva rotas públicas', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/teste-perfis/admin')
      .expect(401);
    expect(res.body.code).toBe('NAO_AUTENTICADO');
    await request(app.getHttpServer()).get('/v1/teste-autenticado').expect(401);
    await request(app.getHttpServer())
      .get('/v1/teste-perfis/publico')
      .expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
  });
  it('Comercial altera somente recurso próprio; Gestor e Admin podem alterar ambos; Consulta não altera', async () => {
    for (const perfil of perfis) {
      for (const dono of [usuarios[perfil].id, randomUUID()]) {
        const permitido =
          perfil === 'ADMINISTRADOR' ||
          perfil === 'GESTOR' ||
          (perfil === 'COMERCIAL' && dono === usuarios[perfil].id);
        const res = await request(app.getHttpServer())
          .get(`/v1/teste-perfis/propriedade/${dono}`)
          .auth(usuarios[perfil].token, { type: 'bearer' })
          .expect(permitido ? 200 : 403);
        if (!permitido) expect(res.body.code).toBe('ACESSO_NEGADO');
      }
    }
  });
  it('usa o perfil atual do banco após alteração, sem precisar emitir outro token', async () => {
    const token = usuarios.ADMINISTRADOR.token;
    await prisma.usuario.update({
      where: { id: usuarios.ADMINISTRADOR.id },
      data: { perfilId: usuarios.GESTOR.perfilId },
    });
    await request(app.getHttpServer())
      .get('/v1/teste-perfis/admin')
      .auth(token, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/teste-perfis/gestor')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });
});
