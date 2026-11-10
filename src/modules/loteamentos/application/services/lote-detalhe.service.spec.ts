import { LoteDetalheService } from './lote-detalhe.service.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';

describe('LoteDetalheService', () => {
  const repository = { find: vi.fn() };
  const service = new LoteDetalheService(repository);
  const usuario = { id: 'vendedor', nome: 'Nome', email: 'email@exemplo.com' };

  it.each([
    ['ADMINISTRADOR', true, true, undefined],
    ['GESTOR', true, true, undefined],
    ['COMERCIAL', true, false, 'vendedor'],
    ['CONSULTA', false, false, undefined],
  ] as const)(
    'aplica a projeção do perfil %s',
    async (perfil, podeVerReservas, podeVerAuditoriaDoLote, vendedorId) => {
      const detalhe = { lote: { id: 'lote' } };
      repository.find.mockResolvedValue(detalhe);
      const ator: UsuarioAutenticado = { ...usuario, perfil };
      await expect(service.find('lote', ator)).resolves.toBe(detalhe);
      expect(repository.find).toHaveBeenLastCalledWith('lote', {
        podeVerReservas,
        podeVerAuditoriaDoLote,
        vendedorId,
      });
    },
  );

  it('responde com 404 quando o lote não existe', async () => {
    repository.find.mockResolvedValue(null);
    await expect(
      service.find('lote', { ...usuario, perfil: 'GESTOR' }),
    ).rejects.toMatchObject({
      code: 'LOTE_NAO_ENCONTRADO',
    });
  });
});
