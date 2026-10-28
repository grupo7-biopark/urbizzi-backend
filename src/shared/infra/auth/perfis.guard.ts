import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UsuarioAutenticado } from '../../domain/usuario-autenticado.js';
import { IS_PUBLIC } from './public.decorator.js';
import { PERFIS_KEY } from './perfis.decorator.js';
@Injectable()
export class PerfisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const alvos = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, alvos))
      return true;
    const usuario = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>().user;
    if (!usuario) throw new UnauthorizedException('Autenticação necessária');
    const perfis = this.reflector.getAllAndOverride<
      UsuarioAutenticado['perfil'][]
    >(PERFIS_KEY, alvos);
    if (perfis === undefined) return true;
    if (!perfis.includes(usuario.perfil))
      throw new ForbiddenException(
        'Você não tem permissão para executar esta ação',
      );
    return true;
  }
}
