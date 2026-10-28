import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Perfis } from './perfis.decorator.js';
import { Public } from './public.decorator.js';
import { PerfisGuard } from './perfis.guard.js';
import type { UsuarioAutenticado } from '../../domain/usuario-autenticado.js';
@Perfis('GESTOR')
class Rotas {
  padrao() {}
  @Perfis('ADMINISTRADOR')
  admin() {}
  @Perfis()
  nenhum() {}
  @Public()
  publico() {}
}
class SemRestricao {
  get() {}
}
@Public()
class ControllerPublico {
  get() {}
}
const perfis = ['ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA'] as const;
describe('PerfisGuard', () => {
  const guard = new PerfisGuard(new Reflector());
  function context(
    target: typeof Rotas | typeof SemRestricao | typeof ControllerPublico,
    handler: Function,
    perfil?: UsuarioAutenticado['perfil'],
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => target,
      switchToHttp: () => ({
        getRequest: () => ({ user: perfil ? { id: 'u', perfil } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }
  it.each(perfis)('aplica lista do controller a %s', (perfil) => {
    const acao = () =>
      guard.canActivate(context(Rotas, Rotas.prototype.padrao, perfil));
    if (perfil === 'GESTOR') expect(acao()).toBe(true);
    else expect(acao).toThrow('Você não tem permissão');
  });
  it.each(perfis)('lista do método substitui controller para %s', (perfil) => {
    const acao = () =>
      guard.canActivate(context(Rotas, Rotas.prototype.admin, perfil));
    if (perfil === 'ADMINISTRADOR') expect(acao()).toBe(true);
    else expect(acao).toThrow('Você não tem permissão');
  });
  it.each(perfis)(
    'sem metadados permite autenticado %s; lista vazia nega',
    (perfil) => {
      expect(
        guard.canActivate(
          context(SemRestricao, SemRestricao.prototype.get, perfil),
        ),
      ).toBe(true);
      expect(() =>
        guard.canActivate(context(Rotas, Rotas.prototype.nenhum, perfil)),
      ).toThrow('Você não tem permissão');
    },
  );
  it('rotas públicas dispensam usuário, mesmo com perfil no controller', () => {
    expect(guard.canActivate(context(Rotas, Rotas.prototype.publico))).toBe(
      true,
    );
    expect(
      guard.canActivate(
        context(ControllerPublico, ControllerPublico.prototype.get),
      ),
    ).toBe(true);
  });
  it('não libera rota protegida sem autenticação', () => {
    expect(() =>
      guard.canActivate(context(SemRestricao, SemRestricao.prototype.get)),
    ).toThrow('Autenticação necessária');
  });
});
