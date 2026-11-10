import { NominatimGeocodificador } from './nominatim-geocodificador.js';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../../config/env.validation.js';
describe('Nominatim local', () => {
  let fetchMock: ReturnType<typeof vi.fn>, provider: NominatimGeocodificador;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: 'Toledo', lat: '-24.72', lon: '-53.74' },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);
    provider = new NominatimGeocodificador({
      get: () => 'https://nominatim.openstreetmap.org/search',
    } as unknown as ConfigService<Env, true>);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('serializa consultas a pelo menos 1 segundo e reutiliza cache', async () => {
    const p1 = provider.search('Toledo'),
      p2 = provider.search('Cascavel');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1099);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await provider.search(' TOLEDO ')).toEqual([
      { nome: 'Toledo', latitude: -24.72, longitude: -53.74 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['User-Agent']).toContain(
      'Urbizzi-local',
    );
  });
  it('trata falha do serviço sem travar a fila', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    const result = provider.search('Toledo').catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await result).toMatchObject({
      code: 'BUSCA_GEOGRAFICA_INDISPONIVEL',
    });
    const next = provider.search('Cascavel');
    await vi.runAllTimersAsync();
    expect(await next).toHaveLength(1);
  });
  it('descarta resultados malformados', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [null, {}, { display_name: 'x', lat: 'x', lon: '0' }],
    });
    const p = provider.search('Toledo');
    await vi.runAllTimersAsync();
    expect(await p).toEqual([]);
  });
});
