import { BusinessRuleError } from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import type { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import type { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import type { CelulaPlanilha } from '../../domain/models/linha-importacao.entity.js';
import { Lote } from '../../domain/models/lote.entity.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import type { LoteRepository } from '../../domain/repositories/lote.repository.interface.js';
import type { LoteamentoRepository } from '../../domain/repositories/loteamento.repository.interface.js';
import type { Planilha } from '../../domain/repositories/planilha.interface.js';
import type { QuadraRepository } from '../../domain/repositories/quadra.repository.interface.js';
import {
  ImportacaoLotesService,
  MAX_LINHAS_IMPORTACAO,
} from './importacao-lotes.service.js';

describe('ImportacaoLotesService', () => {
  const usuario: UsuarioAutenticado = {
    id: 'usuario-id',
    nome: 'Gestor',
    email: 'gestor@exemplo.com',
    perfil: 'GESTOR',
  };
  const tx = { transacao: true };
  const CABECALHO = ['loteamento', 'quadra', 'numero', 'area_m2', 'valor'];
  const arquivo = { nome: 'lotes.XLSX', conteudo: Buffer.from('x') };
  const bela = Loteamento.create({ nome: 'Bela Vista' });
  const quadraA = Quadra.create({ loteamentoId: bela.id, numero: 'A' });

  let planilha: {
    ler: ReturnType<typeof vi.fn>;
    gerar: ReturnType<typeof vi.fn>;
  };
  let loteamentos: Record<
    'findByNomes' | 'create' | 'travarExistentes',
    ReturnType<typeof vi.fn>
  >;
  let quadras: Record<
    'findByLoteamentoIds' | 'create' | 'travarExistentes',
    ReturnType<typeof vi.fn>
  >;
  let lotes: Record<'findByQuadraIds' | 'createMany', ReturnType<typeof vi.fn>>;
  let auditoria: { registrarVarios: ReturnType<typeof vi.fn> };
  let transactionManager: { run: ReturnType<typeof vi.fn> };
  let service: ImportacaoLotesService;

  beforeEach(() => {
    planilha = {
      ler: vi.fn(),
      gerar: vi.fn().mockResolvedValue(Buffer.from('m')),
    };
    loteamentos = {
      travarExistentes: vi.fn((ids: string[]) => Promise.resolve(ids)),
      findByNomes: vi.fn().mockResolvedValue([bela]),
      create: vi.fn(),
    };
    quadras = {
      travarExistentes: vi.fn((ids: string[]) => Promise.resolve(ids)),
      findByLoteamentoIds: vi.fn().mockResolvedValue([quadraA]),
      create: vi.fn(),
    };
    lotes = {
      findByQuadraIds: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
    };
    auditoria = { registrarVarios: vi.fn() };
    transactionManager = {
      run: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    service = new ImportacaoLotesService(
      planilha as unknown as Planilha,
      loteamentos as unknown as LoteamentoRepository,
      quadras as unknown as QuadraRepository,
      lotes as unknown as LoteRepository,
      transactionManager as unknown as TransactionManager,
      auditoria as unknown as AuditoriaService,
    );
  });

  function comLinhas(...linhas: CelulaPlanilha[][]) {
    planilha.ler.mockResolvedValue([CABECALHO, ...linhas]);
  }

  describe('leitura do arquivo', () => {
    it('lança IMPORTACAO_FORMATO_INVALIDO para extensão não suportada', async () => {
      await expect(
        service.importar({ ...arquivo, nome: 'lotes.pdf' }, {}, usuario),
      ).rejects.toMatchObject({
        constructor: BusinessRuleError,
        code: 'IMPORTACAO_FORMATO_INVALIDO',
      });
      expect(planilha.ler).not.toHaveBeenCalled();
    });

    it('lê no formato da extensão, sem diferenciar maiúsculas', async () => {
      comLinhas(['Bela Vista', 'A', '1', '360']);

      await service.importar(arquivo, {}, usuario);

      expect(planilha.ler).toHaveBeenCalledWith(arquivo.conteudo, 'xlsx');
    });

    it('lança IMPORTACAO_COLUNAS_AUSENTES', async () => {
      planilha.ler.mockResolvedValue([['loteamento', 'valor']]);

      await expect(
        service.importar(arquivo, {}, usuario),
      ).rejects.toMatchObject({
        code: 'IMPORTACAO_COLUNAS_AUSENTES',
        message:
          'Colunas obrigatórias ausentes no cabeçalho: quadra, numero, area_m2',
      });
    });

    it('lança IMPORTACAO_SEM_LINHAS para arquivo vazio ou só com linhas em branco', async () => {
      for (const conteudo of [[], [CABECALHO, [null, ' ', '']]]) {
        planilha.ler.mockResolvedValue(conteudo);

        await expect(
          service.importar(arquivo, {}, usuario),
        ).rejects.toMatchObject({
          code: conteudo.length
            ? 'IMPORTACAO_SEM_LINHAS'
            : 'IMPORTACAO_COLUNAS_AUSENTES',
        });
      }
    });

    it('lança IMPORTACAO_LIMITE_EXCEDIDO acima do máximo de linhas', async () => {
      comLinhas(
        ...Array.from({ length: MAX_LINHAS_IMPORTACAO + 1 }, (_, i) => [
          'Bela Vista',
          'A',
          String(i),
          '360',
        ]),
      );

      await expect(
        service.importar(arquivo, {}, usuario),
      ).rejects.toMatchObject({ code: 'IMPORTACAO_LIMITE_EXCEDIDO' });
    });
  });

  describe('prévia', () => {
    it('valida sem gravar e conta as linhas preenchidas', async () => {
      comLinhas(
        ['Bela Vista', 'A', '1', '360', '250000'],
        [null, null, null, null, null],
        ['bela vista', 'a', '2', '300,5', ''],
      );

      const resultado = await service.importar(arquivo, {}, usuario);

      expect(resultado).toEqual({
        importado: false,
        totalLinhas: 2,
        lotes: 2,
        loteamentosNovos: 0,
        quadrasNovas: 0,
        erros: [],
      });
      expect(loteamentos.findByNomes).toHaveBeenCalledWith(['bela vista']);
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('relata linhas inválidas, repetidas e já cadastradas com o número da planilha', async () => {
      lotes.findByQuadraIds.mockResolvedValue([
        Lote.create({
          quadraId: quadraA.id,
          loteamentoId: bela.id,
          numero: '9',
          areaM2: '1',
        }),
      ]);
      comLinhas(
        ['Bela Vista', 'A', '1', '360'],
        ['Bela Vista', 'A', '', '0'],
        ['BELA VISTA', 'a', '1', '200'],
        ['Bela Vista', 'A', '9', '200'],
      );

      const resultado = await service.importar(
        arquivo,
        { confirmar: true },
        usuario,
      );

      expect(resultado).toMatchObject({ importado: false, lotes: 1 });
      expect(resultado.erros).toEqual([
        {
          linha: 3,
          mensagens: [
            'numero é obrigatório',
            'area_m2 deve ser um número positivo com até 10 dígitos inteiros e 2 casas decimais',
          ],
        },
        {
          linha: 4,
          mensagens: ['Lote repetido na planilha (mesmo da linha 2)'],
        },
        { linha: 5, mensagens: ['Lote já cadastrado no sistema'] },
      ]);
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it('sem criarCadastros, relata loteamento e quadra inexistentes', async () => {
      comLinhas(['Novo', 'A', '1', '360'], ['Bela Vista', 'Z', '1', '360']);

      const resultado = await service.importar(arquivo, {}, usuario);

      expect(resultado.erros).toEqual([
        { linha: 2, mensagens: ['Loteamento "Novo" não cadastrado'] },
        {
          linha: 3,
          mensagens: ['Quadra "Z" não cadastrada no loteamento "Bela Vista"'],
        },
      ]);
    });
  });

  describe('confirmação', () => {
    it('cria loteamentos, quadras e lotes e audita tudo na mesma transação', async () => {
      loteamentos.findByNomes.mockResolvedValue([]);
      quadras.findByLoteamentoIds.mockResolvedValue([]);
      comLinhas(
        ['Novo', 'A', '1', '360', '1000'],
        ['novo', 'a', '2', '360'],
        ['Novo', 'B', '1', '360'],
      );

      const resultado = await service.importar(
        arquivo,
        { confirmar: true, criarCadastros: true },
        usuario,
      );

      expect(resultado).toMatchObject({
        importado: true,
        lotes: 3,
        loteamentosNovos: 1,
        quadrasNovas: 2,
        erros: [],
      });
      expect(loteamentos.create).toHaveBeenCalledOnce();
      expect(loteamentos.create.mock.calls[0]).toEqual([
        expect.objectContaining({ nome: 'Novo' }),
        tx,
      ]);
      expect(quadras.create).toHaveBeenCalledTimes(2);
      const [criados, transacao] = lotes.createMany.mock.calls[0];
      expect(transacao).toBe(tx);
      expect(criados.map((l: Lote) => [l.numero, l.areaM2, l.valor])).toEqual([
        ['1', '360.00', '1000.00'],
        ['2', '360.00', null],
        ['1', '360.00', null],
      ]);
      const [registros] = auditoria.registrarVarios.mock.calls[0];
      expect(registros).toHaveLength(6);
      expect(
        registros.map((r: { entidadeTipo: string }) => r.entidadeTipo),
      ).toEqual(['Loteamento', 'Quadra', 'Quadra', 'Lote', 'Lote', 'Lote']);
      expect(registros[0]).toMatchObject({
        usuarioId: usuario.id,
        acao: 'CRIAR',
        motivo: 'Importação de planilha',
      });
    });

    it('usa loteamento e quadra existentes', async () => {
      comLinhas(['Bela Vista', 'A', '1', '360']);

      await service.importar(arquivo, { confirmar: true }, usuario);

      expect(loteamentos.create).not.toHaveBeenCalled();
      expect(quadras.create).not.toHaveBeenCalled();
      expect(lotes.createMany.mock.calls[0][0][0]).toMatchObject({
        quadraId: quadraA.id,
        loteamentoId: bela.id,
      });
    });
  });

  it.each([
    [
      'xlsx',
      360,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['csv', '360,00', 'text/csv; charset=utf-8'],
  ] as const)('gera o modelo %s', async (formato, area, tipo) => {
    const modelo = await service.modelo(formato);

    expect(modelo).toMatchObject({
      nome: `modelo-importacao-lotes.${formato}`,
      tipo,
    });
    const [linhas] = planilha.gerar.mock.calls[0];
    expect(linhas[0]).toEqual([
      'loteamento',
      'quadra',
      'numero',
      'area_m2',
      'valor',
      'exibir_valor',
    ]);
    expect(linhas[1][3]).toBe(area);
  });
});
