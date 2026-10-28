import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../../../config/env.validation.js';
import type { AccessToken } from '../../domain/repositories/access-token.interface.js';
@Injectable()
export class JwtAccessToken implements AccessToken {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}
  get expiresIn() {
    return this.config.get('JWT_EXPIRES_IN', { infer: true });
  }
  get refreshExpiresIn() {
    return this.config.get('REFRESH_TOKEN_EXPIRES_IN', { infer: true });
  }
  sign(usuario: { id: string; nome: string; perfil: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: usuario.id, nome: usuario.nome, perfil: usuario.perfil },
      {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        algorithm: 'HS256',
        expiresIn: this.expiresIn,
        issuer: 'urbizzi',
        audience: 'urbizzi-api',
      },
    );
  }
  async verify(token: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        algorithms: ['HS256'],
        issuer: 'urbizzi',
        audience: 'urbizzi-api',
      });
      return typeof payload.sub === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          payload.sub,
        ) &&
        typeof payload.exp === 'number'
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }
}
