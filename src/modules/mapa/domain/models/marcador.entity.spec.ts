import { Marcador } from './marcador.entity.js';
describe('Marcador', () => {
  it('cria, move e restaura coordenadas incluindo limites', () => {
    const m = Marcador.create({ plantaId: 'p', loteId: 'l', x: 0, y: 1 });
    expect(m.dados.id).toBeDefined();
    m.mover({ x: 1, y: 0 });
    expect(Marcador.restore(m.dados).dados).toEqual(m.dados);
  });
  it.each([-0.1, 1.1, NaN, Infinity])('rejeita coordenada %s', (x) => {
    expect(() =>
      Marcador.create({ plantaId: 'p', loteId: 'l', x, y: 0 }),
    ).toThrow('Coordenadas');
  });
});
