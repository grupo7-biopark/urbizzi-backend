import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import { setupApp } from '../../src/app.setup.js';
import { AuthService } from '../../src/modules/auth/application/services/auth.service.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import type { UsuarioAutenticado } from '../../src/shared/domain/usuario-autenticado.js';
let hash: Promise<string> | undefined;
export async function criarAppTeste(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  setupApp(app);
  await app.init();
  return app;
}
export async function criarUsuarioTeste(
  app: INestApplication,
  codigo: UsuarioAutenticado['perfil'],
) {
  const prisma = app.get(PrismaService);
  const perfil = await prisma.perfil.upsert({
    where: { codigo },
    create: { codigo, nome: codigo },
    update: {},
  });
  hash ??= new Argon2PasswordHasher().hash('SenhaTeste123!');
  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Usuário Teste',
      email: `${randomUUID()}@exemplo.com`,
      senhaHash: await hash,
      perfilId: perfil.id,
    },
  });
  const tokens = await app
    .get(AuthService)
    .login({ email: usuario.email, senha: 'SenhaTeste123!' });
  return { ...usuario, token: tokens.accessToken };
}
