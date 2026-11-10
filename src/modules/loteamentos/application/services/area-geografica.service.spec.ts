import { AreaGeograficaService } from './area-geografica.service.js';
import type {
  AreaGeografica,
  AreaGeograficaRepository,
} from '../../domain/repositories/area-geografica.repository.interface.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
const vertices: [number, number][] = [
  [0, 0],
  [0, 4],
  [4, 4],
  [4, 0],
];
const parent: AreaGeografica = {
  id: 'p',
  quadraId: null,
  tipo: 'LOTEAMENTO',
  loteamentoId: 'p',
  nome: 'P',
  status: null,
  vertices,
};
describe('AreaGeograficaService', () => {
  const repository = {
    scope: vi.fn(),
    quadraDoLote: vi.fn(),
    lock: vi.fn(),
    children: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
  };
  const auditoria = { registrar: vi.fn() };
  const transactions = { run: vi.fn((fn) => fn({})) };
  let service: AreaGeograficaService;
  beforeEach(() => {
    vi.resetAllMocks();
    repository.scope.mockResolvedValue('p');
    repository.quadraDoLote.mockResolvedValue('q');
    repository.children.mockResolvedValue([]);
    repository.findById.mockResolvedValue(parent);
    transactions.run.mockImplementation((fn) => fn({}));
    service = new AreaGeograficaService(
      repository as AreaGeograficaRepository,
      transactions as unknown as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });
  it('persiste e audita somente quantidade de vértices', async () => {
    await service.save('LOTE', 'l', { vertices }, 'u');
    expect(repository.save).toHaveBeenCalledWith(
      { id: 'l', tipo: 'LOTE', loteamentoId: 'p', vertices },
      {},
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ valorNovo: { quantidadeVertices: 4 } }),
      {},
    );
  });
  it('valida quadra contra pai, vizinhas e lotes que já pertencem a ela', async () => {
    await service.save('QUADRA', 'q', { vertices }, 'u');
    repository.children.mockResolvedValue([
      { ...parent, id: 'outra', tipo: 'QUADRA' },
    ]);
    await expect(
      service.save('QUADRA', 'q', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'QUADRAS_SOBREPOSTAS' });
    repository.children.mockResolvedValue([
      { ...parent, id: 'l', tipo: 'LOTE', quadraId: 'q' },
    ]);
    await expect(
      service.save('QUADRA', 'q', { vertices: null }, 'u'),
    ).rejects.toMatchObject({ code: 'QUADRA_COM_DEMARCACOES' });
    await expect(
      service.save(
        'QUADRA',
        'q',
        {
          vertices: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ],
        },
        'u',
      ),
    ).rejects.toMatchObject({ code: 'LOTE_FORA_DA_QUADRA' });
    repository.findById.mockResolvedValue(null);
    repository.children.mockResolvedValue([]);
    await expect(
      service.save('QUADRA', 'q', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'LOTEAMENTO_SEM_DEMARCACAO' });
  });
  it('exige o limite da quadra do lote', async () => {
    repository.findById
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(null);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'QUADRA_SEM_DEMARCACAO' });
    repository.quadraDoLote.mockResolvedValue(null);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'QUADRA_SEM_DEMARCACAO' });
  });
  it('usa a transação recebida sem abrir outra', async () => {
    await service.save('LOTEAMENTO', 'p', { vertices }, 'u', {} as never);
    expect(transactions.run).not.toHaveBeenCalled();
  });
  it('permite limpar lote e retorna a leitura', async () => {
    await service.save('LOTE', 'l', { vertices: null }, 'u');
    expect(repository.remove).toHaveBeenCalledWith('l', {});
    expect(await service.findById('p')).toEqual({ area: parent });
  });
  it('pagina áreas', async () => {
    repository.list.mockResolvedValue({ items: [parent], total: 1 });
    expect((await service.list({ page: 1, pageSize: 20 })).meta.total).toBe(1);
  });
  it('rejeita formato antes da transação', async () => {
    await expect(
      service.save('LOTE', 'l', { vertices: [] }, 'u'),
    ).rejects.toMatchObject({ code: 'AREA_GEOGRAFICA_INVALIDA' });
    expect(transactions.run).not.toHaveBeenCalled();
  });
  it('rejeita cadastro inexistente ou removido durante espera', async () => {
    repository.scope.mockResolvedValueOnce(null);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'CADASTRO_GEOGRAFICO_NAO_ENCONTRADO' });
    repository.scope.mockResolvedValueOnce('p').mockResolvedValueOnce(null);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'CADASTRO_GEOGRAFICO_NAO_ENCONTRADO' });
  });
  it('exige demarcação do pai', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'LOTEAMENTO_SEM_DEMARCACAO' });
  });
  it('desconsidera a própria área mas rejeita vizinho sobreposto', async () => {
    repository.children.mockResolvedValue([
      { ...parent, id: 'l', tipo: 'LOTE' },
    ]);
    await service.save('LOTE', 'l', { vertices }, 'u');
    repository.children.mockResolvedValue([
      { ...parent, id: 'outro', tipo: 'LOTE' },
    ]);
    await expect(
      service.save('LOTE', 'l', { vertices }, 'u'),
    ).rejects.toMatchObject({ code: 'LOTES_SOBREPOSTOS' });
  });
  it('protege as demarcações dos filhos ao editar ou limpar o pai', async () => {
    repository.children.mockResolvedValue([{ ...parent, tipo: 'LOTE' }]);
    await expect(
      service.save('LOTEAMENTO', 'p', { vertices: null }, 'u'),
    ).rejects.toMatchObject({ code: 'LOTEAMENTO_COM_DEMARCACOES' });
    await expect(
      service.save(
        'LOTEAMENTO',
        'p',
        {
          vertices: [
            [0, 0],
            [0, 1],
            [1, 1],
            [1, 0],
          ],
        },
        'u',
      ),
    ).rejects.toMatchObject({ code: 'LOTE_FORA_DO_LOTEAMENTO' });
    await service.save('LOTEAMENTO', 'p', { vertices }, 'u');
  });
  it('audita primeira demarcação e remoção sem área anterior', async () => {
    repository.findById.mockResolvedValue(null);
    await service.save('LOTEAMENTO', 'p', { vertices: null }, 'u');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        valorAnterior: { quantidadeVertices: 0 },
        valorNovo: { quantidadeVertices: 0 },
      }),
      {},
    );
  });
});
