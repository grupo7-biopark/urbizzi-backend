import { BusinessRuleError } from './errors/domain.error.js';

const DIA_MS = 86400000;
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function validarData(data: Date): void {
  if (!(data instanceof Date) || !Number.isFinite(data.getTime())) {
    throw new BusinessRuleError('DATA_INVALIDA', 'Informe uma data válida');
  }
}

function calendarioUtc(ano: number, mes: number, dia: number): number {
  const data = new Date(0);
  data.setUTCFullYear(ano, mes - 1, dia);
  return data.getTime();
}

/** Representação auxiliar do relógio local; não é um instante UTC real. */
function relogioLocal(data: Date): number {
  const partes = Object.fromEntries(
    formatter.formatToParts(data).map((p) => [p.type, p.value]),
  );
  return (
    calendarioUtc(
      Number(partes.year),
      Number(partes.month),
      Number(partes.day),
    ) +
    Number(partes.hour) * 3600000 +
    Number(partes.minute) * 60000 +
    Number(partes.second) * 1000 +
    data.getUTCMilliseconds()
  );
}

function chave(dia: number): string {
  return new Date(dia).toISOString().slice(0, 10);
}

function domingoPascoa(ano: number): number {
  // Computus gregoriano de Meeus/Jones/Butcher, sem dependência de calendário remoto.
  const a = ano % 19,
    b = Math.floor(ano / 100),
    c = ano % 100;
  const d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const valor = h + l - 7 * m + 114;
  return calendarioUtc(ano, Math.floor(valor / 31), (valor % 31) + 1);
}

function criarCalendario(
  adicionais: readonly string[],
): (dia: number) => boolean {
  const extras = new Set(adicionais);
  for (const data of extras) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !Number.isFinite(Date.parse(`${data}T00:00:00Z`)) ||
      chave(Date.parse(`${data}T00:00:00Z`)) !== data
    ) {
      throw new BusinessRuleError(
        'FERIADO_INVALIDO',
        'Feriados adicionais devem ser datas válidas no formato YYYY-MM-DD',
      );
    }
  }
  const anos = new Map<number, Set<string>>();
  return (dia) => {
    const date = new Date(dia);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) return false;
    const ano = date.getUTCFullYear();
    let feriados = anos.get(ano);
    if (!feriados) {
      feriados = new Set(
        [
          '01-01',
          '04-21',
          '05-01',
          '09-07',
          '10-12',
          '11-02',
          '11-15',
          '12-25',
        ].map((d) => `${ano}-${d}`),
      );
      if (ano >= 2024) feriados.add(`${ano}-11-20`);
      const pascoa = domingoPascoa(ano);
      // Carnaval (segunda/terça) e Corpus Christi são dias não úteis por exigência da BE-12.
      for (const deslocamento of [-48, -47, -2, 60])
        feriados.add(chave(pascoa + deslocamento * DIA_MS));
      anos.set(ano, feriados);
    }
    return !feriados.has(chave(dia)) && !extras.has(chave(dia));
  };
}

/** Exclui o dia inicial; preserva o horário de São Paulo. Zero devolve uma cópia. */
export function adicionarDiasUteis(
  data: Date,
  n: number,
  feriadosAdicionais: readonly string[] = [],
): Date {
  validarData(data);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new BusinessRuleError(
      'QUANTIDADE_DIAS_INVALIDA',
      'A quantidade de dias úteis deve ser um inteiro não negativo',
    );
  const util = criarCalendario(feriadosAdicionais);
  if (n === 0) return new Date(data);
  const local = relogioLocal(data);
  const horario = ((local % DIA_MS) + DIA_MS) % DIA_MS;
  let dia = local - horario;
  let restantes = n;
  while (restantes > 0) {
    dia += DIA_MS;
    validarData(new Date(dia));
    if (util(dia)) restantes--;
  }
  const alvo = dia + horario;
  let instante = alvo;
  // Recalcula o offset no destino: não presume UTC-3 nem soma blocos de 24h ao instante.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const ajuste = alvo - relogioLocal(new Date(instante));
    if (ajuste === 0) break;
    instante += ajuste;
  }
  return new Date(instante);
}

/** Conta dias locais em (inicio, fim]; invertido devolve contagem negativa. Horários são ignorados. */
export function diasUteisEntre(
  inicio: Date,
  fim: Date,
  feriadosAdicionais: readonly string[] = [],
): number {
  validarData(inicio);
  validarData(fim);
  const util = criarCalendario(feriadosAdicionais);
  const primeiro = Math.floor(relogioLocal(inicio) / DIA_MS) * DIA_MS;
  const ultimo = Math.floor(relogioLocal(fim) / DIA_MS) * DIA_MS;
  const sinal = primeiro <= ultimo ? 1 : -1;
  let total = 0;
  for (
    let dia = Math.min(primeiro, ultimo) + DIA_MS;
    dia <= Math.max(primeiro, ultimo);
    dia += DIA_MS
  )
    if (util(dia)) total++;
  return total === 0 ? 0 : sinal * total;
}
