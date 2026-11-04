import { Reserva } from './reserva.entity.js';
describe('Reserva', () => {
  const input = { loteId: 'l', clienteId: 'c', vendedorId: 'v' };
  it('calcula dias corridos como períodos de 24 horas em UTC e tempo restante', () => {
    const inicio = new Date('2026-12-30T23:30:00Z');
    const r = Reserva.create(input, 7, inicio);
    expect(r.dados.dataVencimento.toISOString()).toBe(
      '2027-01-06T23:30:00.000Z',
    );
    expect(r.tempoRestanteSegundos(inicio)).toBe(604800);
    expect(r.tempoRestanteSegundos(new Date('2027-01-07'))).toBe(0);
    expect(
      Reserva.restore({ ...r.dados, status: 'EXPIRADA' }).tempoRestanteSegundos(
        inicio,
      ),
    ).toBe(0);
  });
  it('expira exatamente no vencimento e rejeita antecipação ou repetição', () => {
    const r = Reserva.create(input, 1, new Date('2026-01-01'));
    expect(() => r.expirar(new Date('2026-01-01'))).toThrow(
      'A reserva não está ativa e vencida',
    );
    r.expirar(new Date('2026-01-02'));
    expect(r.dados.status).toBe('EXPIRADA');
    expect(() => r.expirar(new Date('2026-01-03'))).toThrow();
  });
  it.each([0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER])(
    'rejeita prazo inválido %s',
    (dias) => {
      expect(() => Reserva.create(input, dias)).toThrow(
        'Prazo de reserva inválido',
      );
    },
  );
});
