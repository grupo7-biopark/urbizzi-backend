import { HistoricoService } from './historico.service.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
describe('HistoricoService', () => {
  const repository = {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const service = new HistoricoService(repository);
  const usuario = {
    id: 'u',
    perfil: 'GESTOR',
    nome: 'Teste',
    email: 'teste@exemplo.com',
  } as UsuarioAutenticado;
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('combina filtros e inclui o último dia UTC inteiro', async () => {
    const query = {
      page: 1,
      pageSize: 20,
      entidadeTipo: 'Reserva',
      entidadeId: 'id',
      usuarioId: 'autor',
      dataDe: '2026-11-01',
      dataAte: '2026-11-03',
    };
    const result = await service.list(query, usuario);
    expect(result.meta.total).toBe(0);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        entidadeId: 'id',
        usuarioId: 'autor',
        dataAte: new Date('2026-11-03T23:59:59.999Z'),
      }),
      query,
    );
  });
  it('restringe Comercial ao vendedor, sem restringir o autor da alteração', async () => {
    await service.list(
      { page: 1, pageSize: 20 },
      { ...usuario, perfil: 'COMERCIAL' },
    );
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ vendedorId: 'u', usuarioId: undefined }),
      expect.anything(),
    );
    await service.list(
      { page: 1, pageSize: 20, dataAte: '2026-11-03T12:00:00Z' },
      usuario,
    );
  });
  it('nega Consulta e períodos inválidos', async () => {
    await expect(
      service.list(
        { page: 1, pageSize: 20 },
        { ...usuario, perfil: 'CONSULTA' },
      ),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    for (const periodo of [
      { dataDe: 'invalido' },
      { dataAte: 'invalido' },
      { dataDe: '2026-11-04', dataAte: '2026-11-03' },
    ])
      await expect(
        service.list({ page: 1, pageSize: 20, ...periodo }, usuario),
      ).rejects.toMatchObject({ code: 'PERIODO_INVALIDO' });
  });
});
