import { Planta } from './planta.entity.js';

const input = {
  nome: 'Masterplan',
  versao: 2,
  gradeLinhas: 3,
  gradeColunas: 3,
  originais: ['plantas/a/fatia_01_01.png'],
  criadoPorId: 'f1b2c3d4-0000-4000-8000-000000000001',
};

describe('Planta', () => {
  it('cria a planta ENVIADA, inativa e sem metadados de tiles', () => {
    const planta = Planta.create(input);
    expect(planta).toMatchObject({
      nome: 'Masterplan',
      versao: 2,
      status: 'ENVIADA',
      ativa: false,
      larguraPx: null,
      alturaPx: null,
      tilesPath: null,
      maxZoom: null,
      gradeLinhas: 3,
      gradeColunas: 3,
      criadoPorId: input.criadoPorId,
    });
    expect(planta.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(planta.createdAt).toEqual(planta.updatedAt);
  });

  it('usa o id gerado antes do envio e copia a lista de originais', () => {
    const originais = ['plantas/a/imagem.png'];
    const planta = Planta.create({ ...input, id: 'id-fixo', originais });
    originais.push('outro');
    expect(planta.id).toBe('id-fixo');
    expect(planta.originais).toEqual(['plantas/a/imagem.png']);
  });

  it('restaura e expõe o resumo de auditoria', () => {
    const criada = Planta.create(input);
    const planta = Planta.restore({
      id: criada.id,
      nome: 'P',
      versao: 1,
      status: 'PRONTA',
      larguraPx: 100,
      alturaPx: 50,
      tilesPath: 'plantas/x/tiles',
      maxZoom: 2,
      tamanhoTile: 256,
      mensagemErro: null,
      processamentoIniciadoEm: null,
      gradeLinhas: 1,
      gradeColunas: 2,
      originais: [],
      ativa: true,
      criadoPorId: input.criadoPorId,
      createdAt: criada.createdAt,
      updatedAt: criada.updatedAt,
    });
    expect(planta).toMatchObject({
      larguraPx: 100,
      alturaPx: 50,
      tilesPath: 'plantas/x/tiles',
      maxZoom: 2,
    });
    expect(planta.auditoria).toEqual({
      nome: 'P',
      versao: 1,
      status: 'PRONTA',
      ativa: true,
      grade: '1 x 2',
    });
  });

  describe('processamento', () => {
    const metadados = {
      larguraPx: 600,
      alturaPx: 400,
      maxZoom: 2,
      tamanhoTile: 256,
      tilesPath: 'plantas/x',
    };

    it('conclui como PRONTA com os metadados', () => {
      const planta = Planta.create(input);
      planta.falharProcessamento('falhou');
      planta.concluirProcessamento(metadados);
      expect(planta).toMatchObject({
        ...metadados,
        status: 'PRONTA',
        mensagemErro: null,
        processamentoIniciadoEm: null,
      });
    });

    it('registra a falha e permite reprocessar', () => {
      const planta = Planta.create(input);
      planta.falharProcessamento('Imagem corrompida');
      expect(planta).toMatchObject({
        status: 'ERRO',
        mensagemErro: 'Imagem corrompida',
      });

      planta.reprocessar();
      expect(planta).toMatchObject({ status: 'ENVIADA', mensagemErro: null });
    });

    it.each(['ENVIADA', 'PRONTA'] as const)(
      'não reprocessa planta %s',
      (status) => {
        const planta = Planta.create(input);
        if (status === 'PRONTA') planta.concluirProcessamento(metadados);
        expect(() => planta.reprocessar()).toThrow(
          expect.objectContaining({ code: 'PLANTA_NAO_REPROCESSAVEL' }),
        );
      },
    );
  });
});
