import { Quadra } from './quadra.entity.js';

describe('Quadra', () => {
  const loteamentoId = '0b6f3c1e-8a52-4a8e-9d3f-2c7f1e5a9b10';

  it('cria com id e timestamps', () => {
    const quadra = Quadra.create({ loteamentoId, numero: 'A' });

    expect(quadra.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(quadra.auditoria).toEqual({ loteamentoId, numero: 'A' });
    expect(quadra.createdAt).toEqual(quadra.updatedAt);
  });

  it('atualiza o número e ignora número nulo', () => {
    const quadra = Quadra.create({ loteamentoId, numero: 'A' });

    quadra.atualizar({ numero: 'B' });
    quadra.atualizar({ numero: null as unknown as string });

    expect(quadra.numero).toBe('B');
  });

  it('restaura sem alterar os dados', () => {
    const props = {
      id: '1c1b8f8e-5a52-4a8e-9d3f-2c7f1e5a9b10',
      loteamentoId,
      numero: '7',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    };

    const quadra = Quadra.restore(props);

    expect(quadra.id).toBe(props.id);
    expect(quadra.loteamentoId).toBe(loteamentoId);
    expect(quadra.updatedAt).toEqual(props.updatedAt);
  });
});
