import { Module } from '@nestjs/common';
import { PASSWORD_HASHER } from '../../shared/application/auth/password-hasher.js';
import { Argon2PasswordHasher } from '../../shared/infra/auth/argon2-password-hasher.js';
import { UsuarioService } from './application/services/usuario.service.js';
import { USUARIO_REPOSITORY } from './domain/repositories/usuario.repository.interface.js';
import { PrismaUsuarioRepository } from './infra/repositories/prisma-usuario.repository.js';
@Module({
  providers: [
    UsuarioService,
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [UsuarioService],
})
export class UsuariosModule {}
