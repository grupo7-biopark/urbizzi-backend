import { InvalidInputError } from '../../../../shared/domain/errors/domain.error.js';
import { GradeFatias, lerNomeFatia, nomeFatia } from './grade-fatias.entity.js';

function fatias(linhas: number, colunas: number, ext = 'png') {
  const imagens = [];
  for (let l = 1; l <= linhas; l++) {
    for (let c = 1; c <= colunas; c++) {
      imagens.push({
        nome: `${nomeFatia({ linha: l, coluna: c })}.${ext}`,
        largura: 100,
        altura: 80,
      });
    }
  }
  return imagens;
}

function erroDe(fn: () => unknown): InvalidInputError {
  try {
    fn();
  } catch (error) {
    if (error instanceof InvalidInputError) return error;
  }
  throw new Error('esperava InvalidInputError');
}

describe('lerNomeFatia', () => {
  it.each([
    ['fatia_01_01.png', { linha: 1, coluna: 1 }],
    ['fatia_03_02.jpg', { linha: 3, coluna: 2 }],
    ['FATIA_10_12.PNG', { linha: 10, coluna: 12 }],
  ])('lê %s', (nome, posicao) => {
    expect(lerNomeFatia(nome)).toEqual(posicao);
  });

  it.each([
    'fatia_1_1.png',
    'fatia_00_01.png',
    'fatia_01_00.png',
    'fatia_01_01',
    'planta.png',
    'xfatia_01_01.png',
    'fatia_01_01.png.exe/..',
  ])('rejeita %s', (nome) => {
    expect(lerNomeFatia(nome)).toBeNull();
  });

  it('gera o nome com dois dígitos', () => {
    expect(nomeFatia({ linha: 2, coluna: 11 })).toBe('fatia_02_11');
  });
});

describe('GradeFatias', () => {
  it('trata um arquivo com qualquer nome como imagem única', () => {
    const grade = GradeFatias.montar([
      { nome: 'planta.png', largura: 500, altura: 300 },
    ]);
    expect(grade).toMatchObject({ linhas: 1, colunas: 1, imagemUnica: true });
    expect(grade.larguraTotal).toBe(500);
    expect(grade.alturaTotal).toBe(300);
  });

  it('monta a grade 3 x 3 ordenada linha a linha, mesmo fora de ordem', () => {
    const grade = GradeFatias.montar(fatias(3, 3).reverse());
    expect(grade).toMatchObject({ linhas: 3, colunas: 3, imagemUnica: false });
    expect(grade.fatias.map((f) => nomeFatia(f))).toEqual([
      'fatia_01_01',
      'fatia_01_02',
      'fatia_01_03',
      'fatia_02_01',
      'fatia_02_02',
      'fatia_02_03',
      'fatia_03_01',
      'fatia_03_02',
      'fatia_03_03',
    ]);
    expect(grade.larguraTotal).toBe(300);
    expect(grade.alturaTotal).toBe(240);
  });

  it('aceita grade retangular e uma única fatia nomeada', () => {
    expect(GradeFatias.montar(fatias(2, 4))).toMatchObject({
      linhas: 2,
      colunas: 4,
    });
    expect(GradeFatias.montar(fatias(1, 1))).toMatchObject({
      linhas: 1,
      colunas: 1,
    });
  });

  it('exige ao menos um arquivo', () => {
    expect(erroDe(() => GradeFatias.montar([])).code).toBe(
      'ARQUIVO_OBRIGATORIO',
    );
  });

  it('lista as fatias faltantes', () => {
    const imagens = fatias(3, 3).filter(
      (f) => !['fatia_01_03.png', 'fatia_02_02.png'].includes(f.nome),
    );
    const erro = erroDe(() => GradeFatias.montar(imagens));
    expect(erro.code).toBe('PLANTA_GRADE_INCOMPLETA');
    expect(erro.message).toContain('3 x 3');
    expect(erro.details).toEqual([
      { field: 'arquivos', messages: ['fatia_01_03', 'fatia_02_02'] },
    ]);
  });

  it('acusa grade incompleta quando só há uma fatia fora da origem', () => {
    const erro = erroDe(() =>
      GradeFatias.montar([{ nome: 'fatia_01_02.png', largura: 1, altura: 1 }]),
    );
    expect(erro.details?.[0].messages).toEqual(['fatia_01_01']);
  });

  it('rejeita nomes fora do padrão quando há vários arquivos', () => {
    const erro = erroDe(() =>
      GradeFatias.montar([
        ...fatias(1, 2),
        { nome: 'outra.png', largura: 100, altura: 80 },
      ]),
    );
    expect(erro.code).toBe('PLANTA_NOME_FATIA_INVALIDO');
    expect(erro.details?.[0].messages).toEqual(['outra.png']);
  });

  it('rejeita duas imagens na mesma posição', () => {
    const erro = erroDe(() =>
      GradeFatias.montar([...fatias(1, 2), ...fatias(1, 1, 'jpg')]),
    );
    expect(erro.code).toBe('PLANTA_FATIA_DUPLICADA');
    expect(erro.details?.[0].messages).toEqual(['fatia_01_01']);
  });

  it('exige fatias com as mesmas dimensões', () => {
    const imagens = fatias(2, 2);
    imagens[3] = { ...imagens[3], largura: 99 };
    const erro = erroDe(() => GradeFatias.montar(imagens));
    expect(erro.code).toBe('PLANTA_FATIAS_DIMENSOES_DIFERENTES');
    expect(erro.details?.[0].messages).toEqual(['fatia_02_02: 99 x 80 px']);
  });
});
