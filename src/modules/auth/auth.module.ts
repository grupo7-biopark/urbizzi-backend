import { PerfisGuard } from '../../shared/infra/auth/perfis.guard.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTENTICADOR } from '../../shared/domain/usuario-autenticado.js';
import { JwtAuthGuard } from '../../shared/infra/auth/jwt-auth.guard.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AuthService } from './application/services/auth.service.js';
import { ACCESS_TOKEN } from './domain/repositories/access-token.interface.js';
import { SESSAO_REPOSITORY } from './domain/repositories/sessao.repository.interface.js';
import { JwtAccessToken } from './infra/repositories/jwt-access-token.js';
import { PrismaSessaoRepository } from './infra/repositories/prisma-sessao.repository.js';
import { AuthController } from './infra/controllers/auth.controller.js';
@Module({
  imports: [
    UsuariosModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 5 }],
      errorMessage: 'Muitas requisições; tente novamente mais tarde',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTENTICADOR, useExisting: AuthService },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PerfisGuard },
    { provide: ACCESS_TOKEN, useClass: JwtAccessToken },
    { provide: SESSAO_REPOSITORY, useClass: PrismaSessaoRepository },
  ],
  exports: [AuthService],
})
export class AuthModule {}
