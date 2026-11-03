import { Module } from '@nestjs/common';
import { EMAIL } from '../../application/email/email.interface.js';
import { SmtpEmail } from './smtp-email.js';
@Module({
  providers: [{ provide: EMAIL, useClass: SmtpEmail }],
  exports: [EMAIL],
})
export class EmailModule {}
