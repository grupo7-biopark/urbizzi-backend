import {
  validarVertices,
  exigirDentro,
  exigirSemSobreposicao,
  type Vertices,
} from './area-geografica.js';
const square: Vertices = [
  [0, 0],
  [0, 4],
  [4, 4],
  [4, 0],
];
describe('Área geográfica', () => {
  it('aceita polígono simples e copia os vértices', () => {
    expect(validarVertices(square)).toEqual(square);
    expect(validarVertices(square)).not.toBe(square);
  });
  it('aceita contorno detalhado com 500 pontos sem reduzir a precisão', () => {
    const vertices = Array.from({ length: 500 }, (_, i): [number, number] => [
      -24.7 + 0.001 * Math.cos((i * 2 * Math.PI) / 500),
      -53.7 + 0.001 * Math.sin((i * 2 * Math.PI) / 500),
    ]);
    expect(validarVertices(vertices)).toEqual(vertices);
    expect(() => validarVertices([...vertices, [-24.7, -53.7]])).toThrow(
      expect.objectContaining({ code: 'AREA_GEOGRAFICA_INVALIDA' }),
    );
  });
  it.each([
    null,
    [],
    [
      [0, 0],
      [1, 1],
    ],
    [
      [NaN, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [86, 0],
      [0, 1],
      [1, 0],
    ],
    [
      [0, 181],
      [0, 1],
      [1, 0],
    ],
    [
      [0, 0, 3],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ],
    [
      [0, 0],
      [4, 0],
      [2, 0],
      [2, 2],
    ],
    [
      [0, -179],
      [0, 179],
      [1, 179],
    ],
    Array.from({ length: 501 }, (_, i) => [i / 500, 0]),
  ])('rejeita entrada inválida %#', (v) => {
    expect(() => validarVertices(v)).toThrow(
      expect.objectContaining({ code: 'AREA_GEOGRAFICA_INVALIDA' }),
    );
  });
  it('aceita divisa e vértices compartilhados', () => {
    const a: Vertices = [
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
      ],
      b: Vertices = [
        [0, 2],
        [0, 4],
        [2, 4],
        [2, 2],
      ];
    expect(() => exigirDentro(a, square)).not.toThrow();
    expect(() => exigirSemSobreposicao(a, [b])).not.toThrow();
  });
  it('rejeita sobreposição parcial ou total', () => {
    expect(() => exigirSemSobreposicao(square, [square])).toThrow(
      expect.objectContaining({ code: 'LOTES_SOBREPOSTOS' }),
    );
    expect(() =>
      exigirSemSobreposicao(square, [
        [
          [3, 3],
          [3, 5],
          [5, 5],
          [5, 3],
        ],
      ]),
    ).toThrow();
  });
  it('confere as arestas, inclusive em loteamento côncavo', () => {
    const concavo: Vertices = [
      [0, 0],
      [0, 4],
      [4, 4],
      [4, 3],
      [1, 3],
      [1, 1],
      [4, 1],
      [4, 0],
    ];
    expect(() =>
      exigirDentro(
        [
          [0.5, 0.5],
          [3, 0.5],
          [3, 3.5],
          [0.5, 3.5],
        ],
        concavo,
      ),
    ).toThrow(expect.objectContaining({ code: 'LOTE_FORA_DO_LOTEAMENTO' }));
  });
  it('não perde precisão em um terreno pequeno no Paraná', () => {
    const v: Vertices = [
      [-24.7, -53.7],
      [-24.7, -53.7002],
      [-24.7002, -53.7002],
      [-24.7002, -53.7],
    ];
    expect(() => validarVertices(v)).not.toThrow();
    expect(() => exigirDentro(v, v)).not.toThrow();
  });
});
