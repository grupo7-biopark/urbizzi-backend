import { adicionarDiasUteis, diasUteisEntre } from './dias-uteis.js';
const data = (dia: string) => new Date(`${dia}T15:30:12.345Z`);
describe('Dias úteis (America/Sao_Paulo)', () => {
  it.each([
    ['2026-10-23', 1, '2026-10-26'],
    ['2026-12-24', 1, '2026-12-28'],
    ['2026-12-31', 1, '2027-01-04'],
    ['2026-02-13', 1, '2026-02-18'],
    ['2025-02-28', 1, '2025-03-05'],
    ['2024-02-09', 1, '2024-02-14'],
    ['2026-04-02', 1, '2026-04-06'],
    ['2025-04-17', 1, '2025-04-22'],
    ['2024-03-28', 1, '2024-04-01'],
    ['2026-06-03', 1, '2026-06-05'],
    ['2025-06-18', 1, '2025-06-20'],
    ['2026-11-19', 1, '2026-11-23'],
    ['2023-11-17', 1, '2023-11-20'],
    ['2026-10-24', 1, '2026-10-26'],
  ])('%s + %i dia(s) = %s', (inicio, n, fim) => {
    expect(adicionarDiasUteis(data(inicio), n)).toEqual(data(fim));
    expect(diasUteisEntre(data(inicio), data(fim))).toBe(n);
    expect(diasUteisEntre(data(fim), data(inicio))).toBe(-n);
  });
  it('preserva entrada, horário e milissegundos ao adicionar vários dias', () => {
    const inicio = data('2026-04-02');
    expect(adicionarDiasUteis(inicio, 7)).toEqual(data('2026-04-14'));
    expect(inicio).toEqual(data('2026-04-02'));
    const copia = adicionarDiasUteis(inicio, 0);
    expect(copia).toEqual(inicio);
    expect(copia).not.toBe(inicio);
  });
  it('usa o dia de São Paulo, mesmo quando UTC já está no dia seguinte', () => {
    const inicio = new Date('2026-10-24T01:00:00Z');
    expect(adicionarDiasUteis(inicio, 1)).toEqual(
      new Date('2026-10-27T01:00:00Z'),
    );
    expect(
      diasUteisEntre(
        new Date('2026-10-26T01:00:00Z'),
        new Date('2026-10-27T01:00:00Z'),
      ),
    ).toBe(1);
  });
  it('ajusta offset ao atravessar o antigo horário de verão', () => {
    expect(adicionarDiasUteis(new Date('2018-11-01T15:00:00Z'), 1)).toEqual(
      new Date('2018-11-05T14:00:00Z'),
    );
    expect(adicionarDiasUteis(new Date('2019-02-15T14:00:00Z'), 1)).toEqual(
      new Date('2019-02-18T15:00:00Z'),
    );
  });
  it('aceita feriados locais, sem modificar a lista nem duplicar contagem', () => {
    const extras = Object.freeze(['2026-10-26', '2026-10-26']);
    expect(adicionarDiasUteis(data('2026-10-23'), 1, extras)).toEqual(
      data('2026-10-27'),
    );
    expect(diasUteisEntre(data('2026-10-23'), data('2026-10-27'), extras)).toBe(
      1,
    );
  });
  it('intervalos no mesmo dia ou só de fim de semana não têm dias úteis', () => {
    expect(diasUteisEntre(data('2026-10-24'), data('2026-10-25'))).toBe(0);
    expect(diasUteisEntre(data('2026-10-25'), data('2026-10-24'))).toBe(0);
    expect(
      diasUteisEntre(data('2026-10-26'), new Date('2026-10-27T01:00:00Z')),
    ).toBe(0);
  });
  it.each(['01-01-2026', '2026-02-30', 'invalido'])(
    'rejeita feriado inválido %s',
    (feriado) => {
      expect(() =>
        adicionarDiasUteis(data('2026-10-23'), 1, [feriado]),
      ).toThrow(expect.objectContaining({ code: 'FERIADO_INVALIDO' }));
    },
  );
  it.each([-1, 1.5, NaN, Infinity])('rejeita quantidade inválida %s', (n) => {
    expect(() => adicionarDiasUteis(data('2026-10-23'), n)).toThrow(
      expect.objectContaining({ code: 'QUANTIDADE_DIAS_INVALIDA' }),
    );
  });
  it('rejeita datas inválidas nas duas operações', () => {
    expect(() => adicionarDiasUteis(new Date(NaN), 1)).toThrow(
      expect.objectContaining({ code: 'DATA_INVALIDA' }),
    );
    expect(() => diasUteisEntre(data('2026-10-23'), new Date(NaN))).toThrow(
      expect.objectContaining({ code: 'DATA_INVALIDA' }),
    );
  });
});
