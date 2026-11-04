import { acoesMapa } from './acoes-mapa.policy.js';
import type { ItemMapa } from '../repositories/mapa-consulta.repository.interface.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
const item = {
  status: 'DISPONIVEL',
  vendedorId: 'v',
  propostaAprovada: false,
} as ItemMapa;
const usuario = (
  perfil: UsuarioAutenticado['perfil'],
  id = 'v',
): UsuarioAutenticado => ({
  id,
  perfil,
  nome: 'Teste',
  email: 'teste@exemplo.com',
});
describe('Ações no mapa', () => {
  it.each(['ADMINISTRADOR', 'GESTOR'] as const)(
    'aplica regras de gestão para %s',
    (perfil) => {
      const u = usuario(perfil);
      expect(acoesMapa(item, u)).toEqual(['reservar', 'bloquear']);
      expect(acoesMapa({ ...item, status: 'BLOQUEADO' }, u)).toEqual([
        'desbloquear',
      ]);
      expect(acoesMapa({ ...item, status: 'RESERVADO' }, u)).toEqual([
        'verReserva',
      ]);
      expect(
        acoesMapa({ ...item, status: 'RESERVADO', propostaAprovada: true }, u),
      ).toEqual(['verReserva', 'vender']);
      expect(
        acoesMapa(
          {
            ...item,
            status: 'RESERVADO',
            vendedorId: null,
            propostaAprovada: true,
          },
          u,
        ),
      ).toEqual([]);
      expect(acoesMapa({ ...item, status: 'VENDIDO' }, u)).toEqual([]);
    },
  );
  it.each(['DISPONIVEL', 'RESERVADO', 'BLOQUEADO', 'VENDIDO'] as const)(
    'Consulta não recebe ações: %s',
    (status) => {
      expect(
        acoesMapa(
          { ...item, status, propostaAprovada: true },
          usuario('CONSULTA'),
        ),
      ).toEqual([]);
    },
  );
  it('Comercial reserva e consulta somente a própria reserva', () => {
    const u = usuario('COMERCIAL');
    expect(acoesMapa(item, u)).toEqual(['reservar']);
    expect(
      acoesMapa({ ...item, status: 'RESERVADO', propostaAprovada: true }, u),
    ).toEqual(['verReserva']);
    expect(
      acoesMapa(
        { ...item, status: 'RESERVADO' },
        usuario('COMERCIAL', 'outro'),
      ),
    ).toEqual([]);
    expect(acoesMapa({ ...item, status: 'BLOQUEADO' }, u)).toEqual([]);
    expect(acoesMapa({ ...item, status: 'VENDIDO' }, u)).toEqual([]);
  });
});
