import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { GestaoUsuarioService } from './application/services/gestao-usuario.service.js';
import { GESTAO_USUARIO_REPOSITORY } from './domain/repositories/gestao-usuario.repository.interface.js';
import { PrismaGestaoUsuarioRepository } from './infra/repositories/prisma-gestao-usuario.repository.js';
import { UsuariosController } from './infra/controllers/usuarios.controller.js';
import { Module } from '@nestjs/common';
import { PASSWORD_HASHER } from '../../shared/application/auth/password-hasher.js';
import { Argon2PasswordHasher } from '../../shared/infra/auth/argon2-password-hasher.js';
import { UsuarioService } from './application/services/usuario.service.js';
import { USUARIO_REPOSITORY } from './domain/repositories/usuario.repository.interface.js';
import { PrismaUsuarioRepository } from './infra/repositories/prisma-usuario.repository.js';
@Module({
  imports: [AuditoriaModule],
  controllers: [UsuariosController],
  providers: [
    UsuarioService,
    GestaoUsuarioService,
    {
      provide: GESTAO_USUARIO_REPOSITORY,
      useClass: PrismaGestaoUsuarioRepository,
    },
    { provide: USUARIO_REPOSITORY, useClass: PrismaUsuarioRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
  ],
  exports: [UsuarioService],
})
export class UsuariosModule {}
