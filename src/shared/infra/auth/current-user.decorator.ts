import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../../domain/usuario-autenticado.js';
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>().user,
);
