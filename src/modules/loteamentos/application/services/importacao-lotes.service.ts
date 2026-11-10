import { Inject, Injectable } from '@nestjs/common';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error.js';
import type { UsuarioAutenticado } from '../../../../shared/domain/usuario-autenticado.js';
import { TransactionManager } from '../../../../shared/infra/database/transaction.manager.js';
import { AuditoriaService } from '../../../auditoria/application/services/auditoria.service.js';
import {
  COLUNAS_IMPORTACAO,
  LinhaImportacao,
  type ErroLinhaImportacao,
  type ResultadoValidacaoLinha,
} from '../../domain/models/linha-importacao.entity.js';
import { Lote } from '../../domain/models/lote.entity.js';
import { Loteamento } from '../../domain/models/loteamento.entity.js';
import { Quadra } from '../../domain/models/quadra.entity.js';
import {
  LOTE_REPOSITORY,
  type LoteRepository,
} from '../../domain/repositories/lote.repository.interface.js';
import {
  LOTEAMENTO_REPOSITORY,
  type LoteamentoRepository,
} from '../../domain/repositories/loteamento.repository.interface.js';
import {
  PLANILHA,
  type FormatoPlanilha,
  type Planilha,
} from '../../domain/repositories/planilha.interface.js';
import {
  QUADRA_REPOSITORY,
  type QuadraRepository,
} from '../../domain/repositories/quadra.repository.interface.js';
import type { ImportarLotesDto } from '../dto/importar-lotes.dto.js';
import type { ResultadoImportacaoDto } from '../dto/resultado-importacao.dto.js';

/** Limite de linhas por arquivo, para a gravação caber em uma transação curta. */
export const MAX_LINHAS_IMPORTACAO = 5000;
const MOTIVO = 'Importação de planilha';

type RegistroAuditoria = Parameters<AuditoriaService['registrar']>[0];

const TIPOS: Record<FormatoPlanilha, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export interface ArquivoImportacao {
  nome: string;
  conteudo: Buffer;
}

export interface ArquivoModelo {
  nome: string;
  tipo: string;
  conteudo: Buffer;
}

interface PlanoImportacao {
  totalLinhas: number;
  loteamentos: Loteamento[];
  quadras: Quadra[];
  lotes: Lote[];
  erros: ErroLinhaImportacao[];
}

@Injectable()
export class ImportacaoLotesService {
  constructor(
    @Inject(PLANILHA)
    private readonly planilha: Planilha,
    @Inject(LOTEAMENTO_REPOSITORY)
    private readonly loteamentoRepository: LoteamentoRepository,
    @Inject(QUADRA_REPOSITORY)
    private readonly quadraRepository: QuadraRepository,
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepository: LoteRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  /**
   * Valida a planilha inteira e devolve o relatório. Só grava com
   * `confirmar` e sem nenhum erro, tudo na mesma transação.
   */
  async importar(
    arquivo: ArquivoImportacao,
    dto: ImportarLotesDto,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoImportacaoDto> {
    const linhas = await this.lerLinhas(arquivo);
    const plano = await this.planejar(linhas, dto.criarCadastros ?? false);
    const importado = (dto.confirmar ?? false) && plano.erros.length === 0;
    if (importado) await this.gravar(plano, usuario);
    return {
      importado,
      totalLinhas: plano.totalLinhas,
      lotes: plano.lotes.length,
      loteamentosNovos: plano.loteamentos.length,
      quadrasNovas: plano.quadras.length,
      erros: plano.erros,
    };
  }

  async modelo(formato: FormatoPlanilha): Promise<ArquivoModelo> {
    // No CSV, vírgula decimal (padrão do Excel em português)
    const exemplo =
      formato === 'csv'
        ? ['Residencial Exemplo', 'A', '1', '360,00', '250000,00', 'sim']
        : ['Residencial Exemplo', 'A', '1', 360, 250000, 'sim'];
    return {
      nome: `modelo-importacao-lotes.${formato}`,
      tipo: TIPOS[formato],
      conteudo: await this.planilha.gerar(
        [[...COLUNAS_IMPORTACAO], exemplo],
        formato,
      ),
    };
  }

  private async lerLinhas(
    arquivo: ArquivoImportacao,
  ): Promise<ResultadoValidacaoLinha[]> {
    const formato = arquivo.nome.toLowerCase().match(/\.(csv|xlsx)$/)?.[1];
    if (!formato) {
      throw new BusinessRuleError(
        'IMPORTACAO_FORMATO_INVALIDO',
        'Envie um arquivo .csv ou .xlsx',
      );
    }
    const [cabecalho = [], ...dados] = await this.planilha.ler(
      arquivo.conteudo,
      formato as FormatoPlanilha,
    );
    const { indices, faltando } = LinhaImportacao.mapearCabecalho(cabecalho);
    if (faltando.length > 0) {
      throw new BusinessRuleError(
        'IMPORTACAO_COLUNAS_AUSENTES',
        `Colunas obrigatórias ausentes no cabeçalho: ${faltando.join(', ')}`,
      );
    }
    // A linha 1 é o cabeçalho; os números seguem a numeração da planilha
    const preenchidas = dados
      .map((celulas, indice) => ({ linha: indice + 2, celulas }))
      .filter(({ celulas }) => !LinhaImportacao.linhaVazia(celulas));
    if (preenchidas.length === 0) {
      throw new BusinessRuleError(
        'IMPORTACAO_SEM_LINHAS',
        'A planilha não tem lotes para importar',
      );
    }
    if (preenchidas.length > MAX_LINHAS_IMPORTACAO) {
      throw new BusinessRuleError(
        'IMPORTACAO_LIMITE_EXCEDIDO',
        `A planilha pode ter no máximo ${MAX_LINHAS_IMPORTACAO} lotes`,
      );
    }
    return preenchidas.map(({ linha, celulas }) =>
      LinhaImportacao.validar(linha, celulas, indices),
    );
  }

  private async planejar(
    resultados: ResultadoValidacaoLinha[],
    criarCadastros: boolean,
  ): Promise<PlanoImportacao> {
    const erros = new Map<number, string[]>();
    const adicionarErro = (linha: number, mensagem: string) =>
      erros.set(linha, [...(erros.get(linha) ?? []), mensagem]);

    const vistas = new Map<string, number>();
    const linhas: LinhaImportacao[] = [];
    for (const { linha, erro } of resultados) {
      if (erro) {
        erros.set(erro.linha, erro.mensagens);
        continue;
      }
      const anterior = vistas.get(linha.chave);
      if (anterior !== undefined) {
        adicionarErro(
          linha.linha,
          `Lote repetido na planilha (mesmo da linha ${anterior})`,
        );
        continue;
      }
      vistas.set(linha.chave, linha.linha);
      linhas.push(linha);
    }

    const existentes = await this.carregarExistentes(linhas);
    const loteamentosNovos = new Map<string, Loteamento>();
    const quadrasNovas = new Map<string, Quadra>();
    const lotes: Lote[] = [];
    for (const linha of linhas) {
      const nome = linha.loteamento.toLowerCase();
      let loteamento =
        existentes.loteamentos.get(nome) ?? loteamentosNovos.get(nome);
      if (!loteamento) {
        if (!criarCadastros) {
          adicionarErro(
            linha.linha,
            `Loteamento "${linha.loteamento}" não cadastrado`,
          );
          continue;
        }
        loteamento = Loteamento.create({ nome: linha.loteamento });
        loteamentosNovos.set(nome, loteamento);
      }

      const chaveQuadra = chave(loteamento.id, linha.quadra);
      let quadra =
        existentes.quadras.get(chaveQuadra) ?? quadrasNovas.get(chaveQuadra);
      if (!quadra) {
        if (!criarCadastros) {
          adicionarErro(
            linha.linha,
            `Quadra "${linha.quadra}" não cadastrada no loteamento "${linha.loteamento}"`,
          );
          continue;
        }
        quadra = Quadra.create({
          loteamentoId: loteamento.id,
          numero: linha.quadra,
        });
        quadrasNovas.set(chaveQuadra, quadra);
      }

      if (existentes.lotes.has(chave(quadra.id, linha.numero))) {
        adicionarErro(linha.linha, 'Lote já cadastrado no sistema');
        continue;
      }
      lotes.push(
        Lote.create({
          quadraId: quadra.id,
          loteamentoId: loteamento.id,
          numero: linha.numero,
          areaM2: linha.areaM2,
          valor: linha.valor,
          exibirValorPublico: linha.exibirValorPublico,
        }),
      );
    }

    return {
      totalLinhas: resultados.length,
      loteamentos: [...loteamentosNovos.values()],
      quadras: [...quadrasNovas.values()],
      lotes,
      erros: [...erros.entries()]
        .sort(([a], [b]) => a - b)
        .map(([linha, mensagens]) => ({ linha, mensagens })),
    };
  }

  /** Loteamentos, quadras e lotes já cadastrados que a planilha referencia. */
  private async carregarExistentes(linhas: LinhaImportacao[]) {
    const nomes = [...new Set(linhas.map((l) => l.loteamento.toLowerCase()))];
    const loteamentos = await this.loteamentoRepository.findByNomes(nomes);
    const quadras = await this.quadraRepository.findByLoteamentoIds(
      loteamentos.map((l) => l.id),
    );
    const lotes = await this.loteRepository.findByQuadraIds(
      quadras.map((q) => q.id),
    );
    return {
      loteamentos: new Map(loteamentos.map((l) => [l.nome.toLowerCase(), l])),
      quadras: new Map(
        quadras.map((q) => [chave(q.loteamentoId, q.numero), q]),
      ),
      lotes: new Set(lotes.map((l) => chave(l.quadraId, l.numero))),
    };
  }

  private async gravar(
    plano: PlanoImportacao,
    usuario: UsuarioAutenticado,
  ): Promise<void> {
    const criar = (
      entidadeTipo: string,
      entidade: { id: string; auditoria: RegistroAuditoria['valorNovo'] },
    ): RegistroAuditoria => ({
      usuarioId: usuario.id,
      entidadeTipo,
      entidadeId: entidade.id,
      acao: 'CRIAR',
      valorNovo: entidade.auditoria,
      motivo: MOTIVO,
    });
    await this.transactionManager.run(async (tx) => {
      // Mesma ordem de locks dos cadastros manuais: loteamentos, depois quadras.
      // Duas consultas em lote evitam uma consulta por linha da planilha.
      const novosLoteamentos = new Set(plano.loteamentos.map((l) => l.id));
      const novasQuadras = new Set(plano.quadras.map((q) => q.id));
      const loteamentoIds = [
        ...new Set([
          ...plano.quadras.map((q) => q.loteamentoId),
          ...plano.lotes.map((l) => l.loteamentoId),
        ]),
      ].filter((id) => !novosLoteamentos.has(id));
      const quadraIds = [...new Set(plano.lotes.map((l) => l.quadraId))].filter(
        (id) => !novasQuadras.has(id),
      );
      if (
        (await this.loteamentoRepository.travarExistentes(loteamentoIds, tx))
          .length !== loteamentoIds.length
      )
        throw new NotFoundError(
          'LOTEAMENTO_NAO_ENCONTRADO',
          'Loteamento não encontrado',
        );
      if (
        (await this.quadraRepository.travarExistentes(quadraIds, tx)).length !==
        quadraIds.length
      )
        throw new NotFoundError(
          'QUADRA_NAO_ENCONTRADA',
          'Quadra não encontrada',
        );
      for (const loteamento of plano.loteamentos) {
        await this.loteamentoRepository.create(loteamento, tx);
      }
      for (const quadra of plano.quadras) {
        await this.quadraRepository.create(quadra, tx);
      }
      await this.loteRepository.createMany(plano.lotes, tx);
      await this.auditoriaService.registrarVarios(
        [
          ...plano.loteamentos.map((l) => criar('Loteamento', l)),
          ...plano.quadras.map((q) => criar('Quadra', q)),
          ...plano.lotes.map((l) => criar('Lote', l)),
        ],
        tx,
      );
    });
  }
}

/** Chave de busca de um registro filho pelo pai, sem diferenciar maiúsculas. */
function chave(paiId: string, numero: string): string {
  return `${paiId}\u0000${numero.toLowerCase()}`;
}
