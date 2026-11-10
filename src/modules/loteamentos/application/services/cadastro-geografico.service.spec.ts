import { CadastroGeograficoService } from './cadastro-geografico.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { LoteamentoService } from './loteamento.service.js';
import type { LoteService } from './lote.service.js';
import type { AreaGeograficaService } from './area-geografica.service.js';
describe('Cadastro geográfico atômico', () => {
  const usuario = { id: 'u' } as UsuarioAutenticado;
  const tx = {} as never;
  const transactions = { run: vi.fn((fn) => fn(tx)) };
  const cadastro = { create: vi.fn(), update: vi.fn() };
  const areas = { save: vi.fn(), bloquear: vi.fn() };
  const service = new CadastroGeograficoService(
    transactions as unknown as TransactionManager,
    cadastro as unknown as LoteamentoService,
    cadastro as unknown as LoteService,
    areas as unknown as AreaGeograficaService,
    cadastro as unknown as import('./quadra.service.js').QuadraService,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    cadastro.create.mockResolvedValue({ id: 'novo' });
    cadastro.update.mockResolvedValue({ id: 'existente' });
    areas.save.mockResolvedValue({ area: null });
  });
  it('cria loteamento e área na mesma transação', async () => {
    const dto = { cadastro: { nome: 'A' }, vertices: null };
    expect(await service.createLoteamento(dto, usuario)).toEqual({
      id: 'novo',
    });
    expect(cadastro.create).toHaveBeenCalledWith(dto.cadastro, usuario, tx);
    expect(areas.save).toHaveBeenCalledWith('LOTEAMENTO', 'novo', dto, 'u', tx);
  });
  it('cadastra e edita quadra com o mesmo bloqueio e transação da área', async () => {
    await service.createQuadra(
      'p',
      { cadastro: { numero: 'A' }, vertices: null },
      usuario,
    );
    expect(cadastro.create).toHaveBeenCalledWith(
      'p',
      { numero: 'A' },
      usuario,
      tx,
    );
    expect(areas.save).toHaveBeenCalledWith(
      'QUADRA',
      'novo',
      expect.anything(),
      'u',
      tx,
    );
    await service.updateQuadra(
      'q',
      { cadastro: { numero: 'B' }, vertices: null },
      usuario,
    );
    expect(areas.save).toHaveBeenLastCalledWith(
      'QUADRA',
      'q',
      expect.anything(),
      'u',
      tx,
    );
  });
  it('bloqueia o escopo antes do cadastro para evitar inversão com PUT', async () => {
    await service.updateLoteamento(
      'p',
      { cadastro: { nome: 'B' }, vertices: null },
      usuario,
    );
    expect(areas.bloquear.mock.invocationCallOrder[0]).toBeLessThan(
      cadastro.update.mock.invocationCallOrder[0],
    );
    await service.createLote(
      {
        cadastro: { quadraId: 'q', numero: '1', areaM2: '100.00' },
        vertices: null,
      },
      usuario,
    );
    expect(areas.bloquear).toHaveBeenCalledWith('QUADRA', 'q', tx);
    await service.updateLote(
      'l',
      { cadastro: { numero: '2' }, vertices: null },
      usuario,
    );
    expect(areas.save).toHaveBeenLastCalledWith(
      'LOTE',
      'l',
      expect.anything(),
      'u',
      tx,
    );
  });
  it('propaga falha da demarcação para a transação fazer rollback', async () => {
    areas.save.mockRejectedValueOnce(new Error('fora do limite'));
    await expect(
      service.createLoteamento(
        { cadastro: { nome: 'A' }, vertices: null },
        usuario,
      ),
    ).rejects.toThrow('fora do limite');
  });
});
