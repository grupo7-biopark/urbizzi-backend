import { PropriedadePolicy } from './propriedade.policy.js';
import type { UsuarioAutenticado } from '../usuario-autenticado.js';
describe('PropriedadePolicy', () => {
  it.each(['ADMINISTRADOR', 'GESTOR', 'COMERCIAL', 'CONSULTA'] as const)(
    'valida proprietário e outro usuário para %s',
    (perfil: UsuarioAutenticado['perfil']) => {
      for (const responsavelId of ['usuario', 'outro']) {
        const acao = () =>
          PropriedadePolicy.assertPodeAlterar(
            { id: 'usuario', perfil },
            responsavelId,
          );
        if (
          perfil === 'ADMINISTRADOR' ||
          perfil === 'GESTOR' ||
          (perfil === 'COMERCIAL' && responsavelId === 'usuario')
        )
          expect(acao).not.toThrow();
        else
          expect(acao).toThrow(
            expect.objectContaining({
              code: 'ACESSO_NEGADO',
              message: 'Você não tem permissão para executar esta ação',
            }),
          );
      }
    },
  );
});
