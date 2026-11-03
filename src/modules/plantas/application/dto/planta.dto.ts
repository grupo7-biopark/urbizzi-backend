import { ApiProperty } from '@nestjs/swagger';
import { StatusPlanta } from '../../../../generated/prisma/client.js';
import type { Planta } from '../../domain/models/planta.entity.js';

export class PlantaDto {
  /** @example '7a3e5b2c-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  id: string;
  /** @example 'Masterplan Biopark 2026' */
  nome: string;
  /**
   * Número sequencial da versão, a partir de 1
   * @example 1
   */
  versao: number;
  /** @example 'ENVIADA' */
  @ApiProperty({ enum: StatusPlanta, enumName: 'StatusPlanta' })
  status: StatusPlanta;
  /**
   * Se é a planta exibida no mapa
   * @example false
   */
  ativa: boolean;
  /**
   * Linhas da grade de fatias (1 para imagem única)
   * @example 3
   */
  gradeLinhas: number;
  /**
   * Colunas da grade de fatias (1 para imagem única)
   * @example 3
   */
  gradeColunas: number;
  /**
   * Largura da imagem completa, preenchida após o processamento
   * @example 13212
   */
  larguraPx: number | null;
  /**
   * Altura da imagem completa, preenchida após o processamento
   * @example 10446
   */
  alturaPx: number | null;
  /**
   * Maior nível de zoom dos tiles, preenchido após o processamento
   * @example 6
   */
  maxZoom: number | null;
  /**
   * Tamanho do tile em pixels, preenchido após o processamento
   * @example 256
   */
  tamanhoTile: number | null;
  /**
   * Motivo da falha quando o status é ERRO
   * @example null
   */
  mensagemErro: string | null;
  /** @example '9c4d2e1f-8a52-4a8e-9d3f-2c7f1e5a9b10' */
  criadoPorId: string;
  createdAt: Date;
  updatedAt: Date;

  static from(planta: Planta): PlantaDto {
    const dto = new PlantaDto();
    dto.id = planta.id;
    dto.nome = planta.nome;
    dto.versao = planta.versao;
    dto.status = planta.status;
    dto.ativa = planta.ativa;
    dto.gradeLinhas = planta.gradeLinhas;
    dto.gradeColunas = planta.gradeColunas;
    dto.larguraPx = planta.larguraPx;
    dto.alturaPx = planta.alturaPx;
    dto.maxZoom = planta.maxZoom;
    dto.tamanhoTile = planta.tamanhoTile;
    dto.mensagemErro = planta.mensagemErro;
    dto.criadoPorId = planta.criadoPorId;
    dto.createdAt = planta.createdAt;
    dto.updatedAt = planta.updatedAt;
    return dto;
  }
}
