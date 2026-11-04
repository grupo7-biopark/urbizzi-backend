import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
import type { MapaService } from '../../../mapa/application/services/mapa.service.js';
import type { LinkPublicoService } from './link-publico.service.js';
import { MapaPublicoService } from './mapa-publico.service.js';
import { NotFoundError } from '../../../../shared/domain/errors/domain.error.js';
describe('MapaPublicoService', () => {
  const links = { registrarAcesso: vi.fn() };
  const mapa = { consultarPublico: vi.fn() };
  const service = new MapaPublicoService(
    links as unknown as LinkPublicoService,
    mapa as unknown as MapaService,
    new ConfigService({
      PUBLICO_CONTATO_COMERCIAL: 'https://exemplo.com/atendimento',
    }) as ConfigService<Env, true>,
  );
  const query = { page: 1, pageSize: 20 };
  beforeEach(() => {
    vi.resetAllMocks();
    mapa.consultarPublico.mockResolvedValue({
      planta: { id: 'p' },
      marcadores: { data: [], meta: { total: 0 } },
    });
  });
  it.each([null, 'loteamento'])(
    'aplica escopo %s somente a partir do link',
    async (loteamentoId) => {
      links.registrarAcesso.mockResolvedValue({
        loteamentoId,
        token: 'segredo',
        criadoPorId: 'interno',
      });
      const result = await service.consultar('token', query);
      expect(mapa.consultarPublico).toHaveBeenCalledWith({
        ...query,
        loteamentoId: loteamentoId ?? undefined,
      });
      expect(result.contatoComercial).toBe('https://exemplo.com/atendimento');
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('criadoPorId');
    },
  );
  it('não consulta dados quando o token é inválido', async () => {
    links.registrarAcesso.mockRejectedValue(
      new NotFoundError('LINK_NAO_ENCONTRADO', 'Link não encontrado'),
    );
    await expect(service.consultar('token', query)).rejects.toMatchObject({
      code: 'LINK_NAO_ENCONTRADO',
    });
    expect(mapa.consultarPublico).not.toHaveBeenCalled();
  });
});
