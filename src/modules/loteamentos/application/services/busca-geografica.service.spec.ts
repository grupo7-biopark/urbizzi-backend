import { BuscaGeograficaService } from './busca-geografica.service.js';
it('pagina os resultados da busca geográfica e propaga indisponibilidade', async () => {
  const provider = {
    search: vi.fn().mockResolvedValue([{ nome: 'A' }, { nome: 'B' }]),
  };
  const service = new BuscaGeograficaService(provider);
  const result = await service.search({ q: 'Toledo', page: 2, pageSize: 1 });
  expect(result.data).toEqual([{ nome: 'B' }]);
  expect(result.meta.total).toBe(2);
  provider.search.mockRejectedValue(new Error('indisponível'));
  await expect(
    service.search({ q: 'Toledo', page: 1, pageSize: 5 }),
  ).rejects.toThrow('indisponível');
});
