import { Proposta } from './proposta.entity.js';
describe('Proposta', () => {
  const input = {
    reservaId: 'r',
    vendedorId: 'v',
    valor: '00100.5',
    condicoes: ' À vista ',
    observacoes: null,
  };
  it('calcula prazo excluindo finais de semana e Natal e mantém hora de São Paulo', () => {
    const p = Proposta.create(input, 5, new Date('2026-12-18T15:30:00Z'));
    expect(p.dados.prazoLimite.toISOString()).toBe('2026-12-28T15:30:00.000Z');
    expect(p.dados).toMatchObject({
      valor: '100.50',
      condicoes: 'À vista',
      status: 'EM_ANALISE',
    });
    expect(Proposta.restore(p.dados).dados).toEqual(p.dados);
  });
  it('não altera data inicial e preserva precisão monetária', () => {
    const data = new Date('2026-12-18T15:00:00Z');
    const p = Proposta.create({ ...input, valor: '999999999999.99' }, 1, data);
    expect(p.dados.valor).toBe('999999999999.99');
    expect(data.toISOString()).toBe('2026-12-18T15:00:00.000Z');
  });
  it.each(['0', '-1', '1.001', '1000000000000', 'NaN'])(
    'rejeita valor inválido %s',
    (valor) => {
      expect(() => Proposta.create({ ...input, valor }, 7)).toThrow(
        'Valor e condições',
      );
    },
  );
  it('rejeita condições vazias', () => {
    expect(() => Proposta.create({ ...input, condicoes: '  ' }, 7)).toThrow(
      'Valor e condições',
    );
  });
});
