import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTENTICADOR,
  type Autenticador,
  type UsuarioAutenticado,
} from '../../domain/usuario-autenticado.js';
import { IS_PUBLIC } from './public.decorator.js';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTENTICADOR) private readonly autenticador: Autenticador,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: UsuarioAutenticado;
    }>();
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException('Autenticação necessária');
    req.user = await this.autenticador.autenticarToken(match[1]);
    return true;
  }
}
