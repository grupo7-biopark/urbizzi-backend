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

describe('comandos da reserva', () => {
  const inicio = new Date('2026-11-05T12:00:00Z');
  const criar = () =>
    Reserva.create({ loteId: 'l', clienteId: 'c', vendedorId: 'v' }, 2, inicio);
  it('estende a partir do vencimento original', () => {
    const reserva = criar();
    reserva.renovar(3, inicio);
    expect(reserva.dados.dataVencimento.toISOString()).toBe(
      '2026-11-10T12:00:00.000Z',
    );
  });
  it('recusa renovar no vencimento ou depois de cancelar', () => {
    const reserva = criar();
    expect(() => reserva.renovar(1, reserva.dados.dataVencimento)).toThrow();
    reserva.cancelar();
    expect(reserva.dados.status).toBe('CANCELADA');
    expect(() => reserva.renovar(1, inicio)).toThrow();
    expect(() => reserva.cancelar()).toThrow();
  });
});
