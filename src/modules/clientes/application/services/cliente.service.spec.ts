import { ClienteService } from './cliente.service.js';
import { Cliente } from '../../domain/models/cliente.entity.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
describe('ClienteService', () => {
  const repository = {
    findById: vi.fn(),
    existsByDocumento: vi.fn(),
    list: vi.fn(),
    save: vi.fn(),
  };
  const auditoria = { registrar: vi.fn() };
  let service: ClienteService;
  const input = { nome: 'Teste', documento: '52998224725' };
  beforeEach(() => {
    vi.resetAllMocks();
    repository.existsByDocumento.mockResolvedValue(false);
    service = new ClienteService(
      repository,
      {
        run: async (fn: (tx: object) => Promise<unknown>) => fn({}),
      } as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });
  it('cria, consulta, lista e atualiza com auditoria sem PII', async () => {
    const created = await service.create(input, 'u');
    expect(created.documento).toBe(input.documento);
    expect(auditoria.registrar).toHaveBeenCalledOnce();
    const cliente = Cliente.restore(created);
    repository.findById.mockResolvedValue(cliente);
    expect(await service.findById(created.id)).toEqual(created);
    repository.list.mockResolvedValue({ items: [cliente], total: 1 });
    expect((await service.list({ page: 1, pageSize: 20 })).data).toEqual([
      { id: created.id, nome: 'Teste' },
    ]);
    expect((await service.update(created.id, { nome: 'Novo' }, 'u')).nome).toBe(
      'Novo',
    );
    expect(repository.save).toHaveBeenCalledTimes(2);
  });
  it('nega duplicidade e cliente ausente', async () => {
    repository.existsByDocumento.mockResolvedValue(true);
    await expect(service.create(input, 'u')).rejects.toMatchObject({
      code: 'CLIENTE_DOCUMENTO_DUPLICADO',
    });
    repository.findById.mockResolvedValue(null);
    await expect(service.findById('ausente')).rejects.toMatchObject({
      code: 'CLIENTE_NAO_ENCONTRADO',
    });
  });
});
