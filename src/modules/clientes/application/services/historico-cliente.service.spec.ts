import { HistoricoClienteService } from './historico-cliente.service.js';
import type { HistoricoClienteItem } from '../../domain/repositories/historico-cliente.repository.interface.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';

describe('HistoricoClienteService', () => {
  const repository = { list: vi.fn() };
  const query = { page: 1, pageSize: 20 };
  const usuario = (
    perfil: UsuarioAutenticado['perfil'],
  ): UsuarioAutenticado => ({
    id: 'vendedor',
    nome: 'Teste',
    email: 'teste@exemplo.com',
    perfil,
  });
  const reserva = {
    id: 'reserva',
    status: 'ATIVA' as const,
    dataInicio: '2026-11-01T10:00:00-03:00',
    dataVencimento: '2026-11-10T10:00:00-03:00',
    lote: {
      id: 'lote',
      numero: '1',
      quadra: 'A',
      loteamentoId: 'loteamento',
      loteamento: 'Norte',
    },
  };
  const item: HistoricoClienteItem = {
    tipo: 'RESERVA',
    id: reserva.id,
    data: reserva.dataInicio,
    reserva,
    proposta: null,
  };
  let service: HistoricoClienteService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new HistoricoClienteService(repository);
    repository.list.mockResolvedValue({ items: [item], total: 1 });
  });
  it.each(['ADMINISTRADOR', 'GESTOR'] as const)(
    'permite %s consultar sem filtro de vendedor',
    async (perfil) => {
      const result = await service.list('cliente', query, usuario(perfil));
      expect(repository.list).toHaveBeenCalledWith('cliente', query, undefined);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      });
      expect(result.data[0]).toMatchObject({
        tipo: 'RESERVA',
        proposta: null,
        data: '2026-11-01T13:00:00.000Z',
        reserva: {
          dataInicio: '2026-11-01T13:00:00.000Z',
          dataVencimento: '2026-11-10T13:00:00.000Z',
        },
      });
    },
  );
  it('restringe Comercial às próprias reservas antes da paginação', async () => {
    await service.list('cliente', query, usuario('COMERCIAL'));
    expect(repository.list).toHaveBeenCalledWith('cliente', query, 'vendedor');
  });
  it('nega Consulta antes de consultar dados', async () => {
    await expect(
      service.list('cliente', query, usuario('CONSULTA')),
    ).rejects.toMatchObject({ code: 'ACESSO_NEGADO' });
    expect(repository.list).not.toHaveBeenCalled();
  });
  it('distingue cliente inexistente de histórico vazio', async () => {
    repository.list.mockResolvedValueOnce(null);
    await expect(
      service.list('ausente', query, usuario('GESTOR')),
    ).rejects.toMatchObject({ code: 'CLIENTE_NAO_ENCONTRADO' });
    repository.list.mockResolvedValueOnce({ items: [], total: 0 });
    expect(
      await service.list('cliente', query, usuario('GESTOR')),
    ).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });
  it.each([
    null,
    {
      decididoPorId: 'gestor',
      data: '2026-11-04T10:00:00-03:00',
      motivo: 'Aprovada',
    },
  ])('normaliza datas da proposta e preserva a decisão %j', async (decisao) => {
    repository.list.mockResolvedValue({
      items: [
        {
          ...item,
          tipo: 'PROPOSTA',
          id: 'proposta',
          proposta: {
            id: 'proposta',
            valor: '999999999999.99',
            status: decisao ? 'APROVADA' : 'EM_ANALISE',
            dataEnvio: '2026-11-02T10:00:00-03:00',
            prazoLimite: '2026-11-09T10:00:00-03:00',
            decisao,
          },
        },
      ],
      total: 1,
    });
    const result = await service.list('cliente', query, usuario('GESTOR'));
    expect(result.data[0].proposta).toMatchObject({
      valor: '999999999999.99',
      dataEnvio: '2026-11-02T13:00:00.000Z',
      prazoLimite: '2026-11-09T13:00:00.000Z',
      decisao: decisao
        ? { ...decisao, data: '2026-11-04T13:00:00.000Z' }
        : null,
    });
  });
});
