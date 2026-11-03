import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { ConfiguracaoService } from './application/services/configuracao.service.js';
import { CONFIGURACAO_REPOSITORY } from './domain/repositories/configuracao.repository.interface.js';
import { PrismaConfiguracaoRepository } from './infra/repositories/prisma-configuracao.repository.js';
import { ConfiguracoesController } from './infra/controllers/configuracoes.controller.js';
@Module({
  imports: [AuditoriaModule],
  providers: [
    ConfiguracaoService,
    {
      provide: CONFIGURACAO_REPOSITORY,
      useClass: PrismaConfiguracaoRepository,
    },
  ],
  controllers: [ConfiguracoesController],
  exports: [ConfiguracaoService],
})
export class ConfiguracoesModule {}
