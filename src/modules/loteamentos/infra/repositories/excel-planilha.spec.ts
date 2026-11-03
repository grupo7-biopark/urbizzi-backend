import { ExcelPlanilha, lerCsv } from './excel-planilha.js';

const BOM = String.fromCharCode(0xfeff);

describe('ExcelPlanilha', () => {
  const planilha = new ExcelPlanilha();

  describe('lerCsv', () => {
    it('detecta ponto e vírgula e trata aspas e quebras de linha', () => {
      const linhas = lerCsv(
        'loteamento;quadra;obs\r\n"Bela; Vista";A;"diz ""oi""\nem duas linhas"\r\n',
      );

      expect(linhas).toEqual([
        ['loteamento', 'quadra', 'obs'],
        ['Bela; Vista', 'A', 'diz "oi"\nem duas linhas'],
      ]);
    });

    it('detecta vírgula e tabulação como separador', () => {
      expect(lerCsv('a,b\n1,2')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
      expect(lerCsv('a\tb\n1\t2\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('mantém campos vazios', () => {
      expect(lerCsv('a;b;c\n;;\n')).toEqual([
        ['a', 'b', 'c'],
        ['', '', ''],
      ]);
    });
  });

  describe('ler', () => {
    it('remove o BOM e decodifica Windows-1252 quando não é UTF-8', async () => {
      const utf8 = Buffer.from(BOM + 'área;número\n1;2', 'utf8');
      const latin1 = Buffer.from('área;número\n1;2', 'latin1');

      expect(await planilha.ler(utf8, 'csv')).toEqual([
        ['área', 'número'],
        ['1', '2'],
      ]);
      expect((await planilha.ler(latin1, 'csv'))[0]).toEqual([
        'área',
        'número',
      ]);
    });

    it('lê o XLSX gerado mantendo os números como texto', async () => {
      const conteudo = await planilha.gerar(
        [
          ['loteamento', 'area_m2', 'exibir_valor'],
          ['Bela Vista', 360.5, true],
          ['Outro', null, false],
        ],
        'xlsx',
      );

      expect(await planilha.ler(conteudo, 'xlsx')).toEqual([
        ['loteamento', 'area_m2', 'exibir_valor'],
        ['Bela Vista', '360.5', true],
        ['Outro', null, false],
      ]);
    });

    it('lança IMPORTACAO_ARQUIVO_INVALIDO para XLSX corrompido', async () => {
      await expect(
        planilha.ler(Buffer.from('não é xlsx'), 'xlsx'),
      ).rejects.toMatchObject({ code: 'IMPORTACAO_ARQUIVO_INVALIDO' });
    });
  });

  it('gera CSV com BOM, ponto e vírgula e aspas quando preciso', async () => {
    const conteudo = await planilha.gerar(
      [
        ['a', 'b;c', true],
        [1, null, false],
      ],
      'csv',
    );

    expect(conteudo.toString('utf8')).toBe(BOM + 'a;"b;c";sim\r\n1;;não\r\n');
  });
});
