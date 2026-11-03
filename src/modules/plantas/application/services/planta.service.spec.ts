import type { Storage } from '../../../../shared/application/storage/storage.interface.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import { Planta } from '../../domain/models/planta.entity.js';
import type { PlantaRepository } from '../../domain/repositories/planta.repository.interface.js';
import type {
  MetadadosImagem,
  ProcessadorImagem,
} from '../../domain/repositories/processador-imagem.interface.js';
import { PlantaService } from './planta.service.js';

vi.mock('node:fs', () => ({
  createReadStream: (caminho: string) => `stream:${caminho}`,
}));

const usuario: UsuarioAutenticado = {
  id: 'f1b2c3d4-0000-4000-8000-000000000001',
  perfil: 'GESTOR',
};

function setup(metadados: Record<string, MetadadosImagem | null> = {}) {
  const repository = {
    findById: vi.fn(),
    list: vi.fn(),
    proximaVersao: vi.fn().mockResolvedValue(3),
    create: vi.fn(),
  } satisfies PlantaRepository;
  const processador = {
    lerMetadados: vi.fn(async (caminho: string) =>
      caminho in metadados
        ? metadados[caminho]
        : { formato: 'png', largura: 100, altura: 50 },
    ),
  } satisfies ProcessadorImagem;
  const storage = {
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getSignedUrl: vi.fn(),
  } satisfies Storage;
  const auditoria = { registrar: vi.fn() };
  const tx = { run: vi.fn((fn: (tx: object) => unknown) => fn({})) };
  const service = new PlantaService(
    repository,
    processador,
    storage,
    tx as unknown as TransactionManager,
    auditoria as unknown as AuditoriaService,
  );
  return { service, repository, processador, storage, auditoria };
}

function fatias3x3() {
  const arquivos = [];
  for (let l = 1; l <= 3; l++)
    for (let c = 1; c <= 3; c++)
      arquivos.push({
        nome: `fatia_0${l}_0${c}.png`,
        caminho: `/tmp/${l}${c}`,
      });
  return arquivos;
}

describe('PlantaService', () => {
  describe('enviar', () => {
    it('envia a imagem única e cria a planta ENVIADA com a próxima versão', async () => {
      const { service, repository, storage, auditoria } = setup({
        '/tmp/a': { formato: 'jpeg', largura: 800, altura: 600 },
      });

      const dto = await service.enviar(
        'Masterplan',
        [{ nome: 'minha planta.jpeg', caminho: '/tmp/a' }],
        usuario,
      );

      expect(dto).toMatchObject({
        nome: 'Masterplan',
        versao: 3,
        status: 'ENVIADA',
        ativa: false,
        gradeLinhas: 1,
        gradeColunas: 1,
        larguraPx: null,
        criadoPorId: usuario.id,
      });
      expect(storage.upload).toHaveBeenCalledWith({
        bucket: 'originais',
        key: `plantas/${dto.id}/imagem.jpg`,
        body: 'stream:/tmp/a',
        contentType: 'image/jpeg',
      });
      const planta = repository.create.mock.calls[0][0] as Planta;
      expect(planta.originais).toEqual([`plantas/${dto.id}/imagem.jpg`]);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        {
          usuarioId: usuario.id,
          entidadeTipo: 'Planta',
          entidadeId: dto.id,
          acao: 'CRIAR',
          valorNovo: {
            nome: 'Masterplan',
            versao: 3,
            status: 'ENVIADA',
            ativa: false,
            grade: '1 x 1',
          },
        },
        {},
      );
    });

    it('envia as fatias linha a linha com chaves geradas pelo servidor', async () => {
      const { service, storage, repository } = setup();

      const dto = await service.enviar(
        'Masterplan',
        fatias3x3().reverse(),
        usuario,
      );

      expect(dto).toMatchObject({ gradeLinhas: 3, gradeColunas: 3 });
      const chaves = storage.upload.mock.calls.map(([input]) => input.key);
      expect(chaves).toHaveLength(9);
      expect(chaves[0]).toBe(`plantas/${dto.id}/fatia_01_01.png`);
      expect(chaves[1]).toBe(`plantas/${dto.id}/fatia_01_02.png`);
      expect(chaves[8]).toBe(`plantas/${dto.id}/fatia_03_03.png`);
      expect((repository.create.mock.calls[0][0] as Planta).originais).toEqual(
        chaves,
      );
    });

    it('rejeita arquivos que não são PNG ou JPEG sem enviar nada', async () => {
      const { service, storage } = setup({ '/tmp/b': null });

      await expect(
        service.enviar(
          'P',
          [
            { nome: 'fatia_01_01.png', caminho: '/tmp/a' },
            { nome: 'fatia_01_02.png', caminho: '/tmp/b' },
          ],
          usuario,
        ),
      ).rejects.toMatchObject({
        code: 'PLANTA_FORMATO_INVALIDO',
        details: [{ field: 'arquivos', messages: ['fatia_01_02.png'] }],
      });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejeita grade incompleta sem enviar nada', async () => {
      const { service, storage } = setup();

      await expect(
        service.enviar('P', fatias3x3().slice(1), usuario),
      ).rejects.toMatchObject({ code: 'PLANTA_GRADE_INCOMPLETA' });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejeita planta acima do limite de pixels', async () => {
      const { service, storage } = setup({
        '/tmp/a': { formato: 'png', largura: 20000, altura: 15000 },
      });

      await expect(
        service.enviar('P', [{ nome: 'p.png', caminho: '/tmp/a' }], usuario),
      ).rejects.toMatchObject({ code: 'PLANTA_MUITO_GRANDE' });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('remove os originais já enviados se a gravação falhar', async () => {
      const { service, storage, repository } = setup();
      repository.create.mockRejectedValue(new Error('banco fora'));

      await expect(service.enviar('P', fatias3x3(), usuario)).rejects.toThrow(
        'banco fora',
      );
      const chaves = storage.upload.mock.calls.map(([input]) => input.key);
      expect(storage.delete.mock.calls).toEqual(
        chaves.map((chave) => ['originais', chave]),
      );
    });

    it('remove os originais se o envio ao armazenamento falhar no meio', async () => {
      const { service, storage, repository } = setup();
      storage.upload
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('armazenamento fora'));
      storage.delete.mockRejectedValue(new Error('ignorado'));

      await expect(service.enviar('P', fatias3x3(), usuario)).rejects.toThrow(
        'armazenamento fora',
      );
      expect(storage.delete).toHaveBeenCalledTimes(9);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('consultas', () => {
    const planta = Planta.create({
      nome: 'P',
      versao: 1,
      gradeLinhas: 1,
      gradeColunas: 1,
      originais: ['plantas/x/imagem.png'],
      criadoPorId: usuario.id,
    });

    it('detalha a planta', async () => {
      const { service, repository } = setup();
      repository.findById.mockResolvedValue(planta);
      await expect(service.findById(planta.id)).resolves.toMatchObject({
        id: planta.id,
        versao: 1,
      });
    });

    it('retorna 404 para planta inexistente', async () => {
      const { service, repository } = setup();
      repository.findById.mockResolvedValue(null);
      await expect(service.findById(planta.id)).rejects.toMatchObject({
        code: 'PLANTA_NAO_ENCONTRADA',
      });
    });

    it('lista com paginação e filtro de status', async () => {
      const { service, repository } = setup();
      repository.list.mockResolvedValue({ items: [planta], total: 1 });

      const result = await service.list({
        page: 1,
        pageSize: 20,
        status: ['ENVIADA'],
      });

      expect(repository.list).toHaveBeenCalledWith(
        { status: ['ENVIADA'] },
        { page: 1, pageSize: 20 },
      );
      expect(result.meta).toMatchObject({ total: 1 });
      expect(result.data[0].id).toBe(planta.id);
    });
  });
});
