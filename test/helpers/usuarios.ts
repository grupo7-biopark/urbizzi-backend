import type { INestApplication } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/application/services/auth.service.js';
import type { UsuarioAutenticado } from '../../src/shared/domain/usuario-autenticado.js';
import { Argon2PasswordHasher } from '../../src/shared/infra/auth/argon2-password-hasher.js';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';

export type PerfilTeste = UsuarioAutenticado['perfil'];

export const PERFIS: readonly PerfilTeste[] = [
  'ADMINISTRADOR',
  'GESTOR',
  'COMERCIAL',
  'CONSULTA',
];

export type UsuariosTeste = Record<PerfilTeste, { id: string; token: string }>;

const SENHA = 'SenhaTeste123!';
let senhaHash: Promise<string> | undefined;

/**
 * Cria os perfis e um usuário de cada perfil, devolvendo id e access token.
 * Chame depois de `limparBanco`.
 */
export async function criarUsuarios(
  app: INestApplication,
): Promise<UsuariosTeste> {
  const prisma = app.get(PrismaService);
  senhaHash ??= new Argon2PasswordHasher().hash(SENHA);
  const usuarios = {} as UsuariosTeste;
  for (const codigo of PERFIS) {
    const perfil = await prisma.perfil.create({
      data: { codigo, nome: codigo },
    });
    const email = `${codigo.toLowerCase()}@exemplo.com`;
    const usuario = await prisma.usuario.create({
      data: {
        nome: `Usuário ${codigo}`,
        email,
        senhaHash: await senhaHash,
        perfilId: perfil.id,
      },
    });
    const { accessToken } = await app
      .get(AuthService)
      .login({ email, senha: SENHA });
    usuarios[codigo] = { id: usuario.id, token: accessToken };
  }
  return usuarios;
}
