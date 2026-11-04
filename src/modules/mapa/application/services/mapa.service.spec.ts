import { MapaService } from './mapa.service.js';
import type { PlantaService } from '../../../plantas/application/services/planta.service.js';
import type { ItemMapa } from '../../domain/repositories/mapa-consulta.repository.interface.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
describe('MapaService', () => {
  const repository = { list: vi.fn() };
  const plantas = { ativa: vi.fn() };
  const usuario = {
    id: 'u',
    perfil: 'GESTOR' as const,
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
  };
  const query = { page: 1, pageSize: 20 };
  const service = new MapaService(
    repository,
    plantas as unknown as PlantaService,
  );
  beforeEach(() => {
    vi.resetAllMocks();
    plantas.ativa.mockResolvedValue({
      id: 'p',
      nome: 'Planta',
      criadoPorId: 'segredo',
      tilesUrl: '/tiles',
      originais: ['interno'],
    });
  });
  it('retorna projeção mínima e paginação sem metadados privados', async () => {
    repository.list.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'm',
          loteId: 'l',
          status: 'DISPONIVEL',
          vendedorId: 'v',
          propostaAprovada: true,
          exibirValorPublico: false,
          valor: '100.00',
        } as ItemMapa,
      ],
    });
    const result = await service.consultar(query, usuario);
    expect(repository.list).toHaveBeenCalledWith('p', query);
    expect(result.marcadores.meta.total).toBe(1);
    expect(result.marcadores.data[0]).toMatchObject({
      valor: '100.00',
      acoes: ['reservar', 'bloquear'],
    });
    expect(result.marcadores.data[0]).not.toHaveProperty('vendedorId');
    expect(result.marcadores.data[0]).not.toHaveProperty('propostaAprovada');
    expect(result.planta).not.toHaveProperty('criadoPorId');
    expect(result.planta).not.toHaveProperty('originais');
  });
  it('retorna página vazia', async () => {
    repository.list.mockResolvedValue({ total: 0, items: [] });
    expect((await service.consultar(query, usuario)).marcadores.data).toEqual(
      [],
    );
  });
  it('consulta pública aplica escopo e remove valores não autorizados', async () => {
    repository.list.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'm',
          loteId: 'l',
          status: 'DISPONIVEL',
          valor: '100.00',
          exibirValorPublico: false,
        } as ItemMapa,
      ],
    });
    const result = await service.consultarPublico({
      ...query,
      loteamentoId: 'e',
    });
    expect(repository.list).toHaveBeenCalledWith('p', {
      ...query,
      loteamentoId: 'e',
    });
    expect(result.marcadores.data[0]).not.toHaveProperty('valor');
    expect(result.marcadores.data[0]).not.toHaveProperty('acoes');
  });
  it('propaga ausência de planta ativa sem consultar marcadores', async () => {
    plantas.ativa.mockRejectedValue(
      new NotFoundError('PLANTA_ATIVA_NAO_ENCONTRADA', 'Sem planta'),
    );
    await expect(service.consultar(query, usuario)).rejects.toMatchObject({
      code: 'PLANTA_ATIVA_NAO_ENCONTRADA',
    });
    expect(repository.list).not.toHaveBeenCalled();
  });
});
