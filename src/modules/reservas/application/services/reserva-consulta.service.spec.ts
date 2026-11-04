import { ReservaConsultaService } from './reserva-consulta.service.js';
describe('Consulta de reservas', () => {
  const repository = { list: vi.fn() };
  const service = new ReservaConsultaService(repository);
  const u = {
    id: 'v',
    nome: 'Teste',
    email: 'teste@exemplo.com',
    perfil: 'COMERCIAL' as const,
  };
  const q = { page: 1, pageSize: 20 };
  beforeEach(() => {
    vi.resetAllMocks();
    repository.list.mockResolvedValue({ total: 0, items: [] });
  });
  it('limita Comercial ao próprio usuário mesmo com filtro alheio', async () => {
    expect((await service.list({ ...q, vendedorId: 'outro' }, u)).data).toEqual(
      [],
    );
    expect(repository.list).toHaveBeenCalledWith({ ...q, vendedorId: 'v' });
  });
  it('gestor filtra geral e minhas sempre força o usuário', async () => {
    await service.list(
      { ...q, vendedorId: 'outro' },
      { ...u, perfil: 'GESTOR' },
    );
    expect(repository.list).toHaveBeenLastCalledWith({
      ...q,
      vendedorId: 'outro',
    });
    await service.list(q, { ...u, perfil: 'GESTOR' }, true);
    expect(repository.list).toHaveBeenLastCalledWith({ ...q, vendedorId: 'v' });
  });
  it('nega Consulta e período invertido antes da consulta', async () => {
    await expect(
      service.list(q, { ...u, perfil: 'CONSULTA' }),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    await expect(
      service.list(
        {
          ...q,
          vencimentoDe: '2026-02-01T00:00:00Z',
          vencimentoAte: '2026-01-01T00:00:00Z',
        },
        u,
      ),
    ).rejects.toMatchObject({ code: 'PERIODO_INVALIDO' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('aceita intervalo de ponto único e somente uma extremidade', async () => {
    const data = '2026-01-01T00:00:00Z';
    await service.list({ ...q, vencimentoDe: data, vencimentoAte: data }, u);
    await service.list({ ...q, vencimentoDe: data }, u);
    await service.list({ ...q, vencimentoAte: data }, u);
    expect(repository.list).toHaveBeenCalledTimes(3);
  });
});
