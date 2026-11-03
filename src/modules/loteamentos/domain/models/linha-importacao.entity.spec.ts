import {
  LinhaImportacao,
  type CelulaPlanilha,
  type IndicesColunas,
} from './linha-importacao.entity.js';

describe('LinhaImportacao', () => {
  const indices: IndicesColunas = {
    loteamento: 0,
    quadra: 1,
    numero: 2,
    area_m2: 3,
    valor: 4,
    exibir_valor: 5,
  };

  function validar(celulas: CelulaPlanilha[], idx = indices) {
    return LinhaImportacao.validar(2, celulas, idx);
  }

  describe('mapearCabecalho', () => {
    it('localiza as colunas ignorando maiúsculas, acentos e separadores', () => {
      const { indices: encontrados, faltando } =
        LinhaImportacao.mapearCabecalho([
          'Valor',
          ' LOTEAMENTO ',
          'Quadra',
          'Número',
          'Área (m²)',
          'Exibir valor público',
        ]);

      expect(faltando).toEqual([]);
      expect(encontrados).toEqual({
        valor: 0,
        loteamento: 1,
        quadra: 2,
        numero: 3,
        area_m2: 4,
        exibir_valor: 5,
      });
    });

    it('aceita apelidos e mantém a primeira ocorrência', () => {
      const { indices: encontrados } = LinhaImportacao.mapearCabecalho([
        'loteamento',
        'quadra',
        'lote',
        'area',
        'preço',
        'loteamento',
      ]);

      expect(encontrados).toMatchObject({
        loteamento: 0,
        numero: 2,
        area_m2: 3,
        valor: 4,
      });
    });

    it('informa as colunas obrigatórias ausentes', () => {
      const { faltando } = LinhaImportacao.mapearCabecalho([
        'loteamento',
        null,
        true,
        'valor',
      ]);

      expect(faltando).toEqual(['quadra', 'numero', 'area_m2']);
    });
  });

  it('detecta linha vazia', () => {
    expect(LinhaImportacao.linhaVazia([null, '  ', ''])).toBe(true);
    expect(LinhaImportacao.linhaVazia([null, false])).toBe(false);
  });

  describe('validar', () => {
    it('cria a linha com os textos aparados', () => {
      const { linha, erro } = validar([
        ' Bela Vista ',
        'A',
        '12',
        '360.5',
        '250000',
        'Sim',
      ]);

      expect(erro).toBeUndefined();
      expect(linha).toMatchObject({
        linha: 2,
        loteamento: 'Bela Vista',
        quadra: 'A',
        numero: '12',
        areaM2: '360.5',
        valor: '250000',
        exibirValorPublico: true,
      });
    });

    it.each([
      ['360,50', '360.50'],
      ['1.234,5', '1234.5'],
      ['0,5', '0.5'],
    ])('converte o decimal brasileiro %s', (entrada, esperado) => {
      expect(validar(['L', 'A', '1', entrada]).linha?.areaM2).toBe(esperado);
    });

    it('usa padrões para valor e exibir_valor vazios ou ausentes', () => {
      const comVazios = validar(['L', 'A', '1', '360', '', null]);
      const semColunas = validar(['L', 'A', '1', '360'], {
        loteamento: 0,
        quadra: 1,
        numero: 2,
        area_m2: 3,
      });

      for (const { linha } of [comVazios, semColunas]) {
        expect(linha).toMatchObject({ valor: null, exibirValorPublico: false });
      }
    });

    it.each([
      [true, true],
      [false, false],
      ['NÃO', false],
      ['x', true],
      ['0', false],
    ])('interpreta exibir_valor %s', (entrada, esperado) => {
      expect(
        validar(['L', 'A', '1', '360', null, entrada]).linha
          ?.exibirValorPublico,
      ).toBe(esperado);
    });

    it('reúne todos os motivos da linha', () => {
      const { erro } = validar([
        '',
        'x'.repeat(21),
        null,
        '0',
        '-10',
        'talvez',
      ]);

      expect(erro).toEqual({
        linha: 2,
        mensagens: [
          'loteamento é obrigatório',
          'quadra deve ter no máximo 20 caracteres',
          'numero é obrigatório',
          'area_m2 deve ser um número positivo com até 10 dígitos inteiros e 2 casas decimais',
          'valor deve ser um número positivo com até 12 dígitos inteiros e 2 casas decimais',
          'exibir_valor deve ser sim ou não',
        ],
      });
    });

    it('exige a área', () => {
      expect(validar(['L', 'A', '1', '']).erro?.mensagens).toEqual([
        'area_m2 é obrigatório',
      ]);
    });

    it.each(['1.234', '12345678901', '1,234'])(
      'rejeita área fora do formato %s',
      (area) => {
        expect(validar(['L', 'A', '1', area]).erro).toBeDefined();
      },
    );
  });

  it('gera a mesma chave sem diferenciar maiúsculas', () => {
    const a = validar(['Bela Vista', 'A', '1a', '1']).linha;
    const b = validar(['BELA VISTA', 'a', '1A', '1']).linha;

    expect(a?.chave).toBe(b?.chave);
  });
});
