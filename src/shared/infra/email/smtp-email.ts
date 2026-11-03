import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Env } from '../../../config/env.validation.js';
import type { Email } from '../../application/email/email.interface.js';
@Injectable()
export class SmtpEmail implements Email {
  private readonly transport;
  constructor(private readonly config: ConfigService<Env, true>) {
    this.transport = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      auth: config.get('SMTP_USER', { infer: true })
        ? {
            user: config.get('SMTP_USER', { infer: true }),
            pass: config.get('SMTP_PASSWORD', { infer: true }),
          }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  async enviarRecuperacao(destinatario: string, token: string): Promise<void> {
    const url = new URL(this.config.get('PASSWORD_RESET_URL', { infer: true }));
    url.searchParams.set('token', token);
    await this.transport.sendMail({
      from: this.config.get('SMTP_FROM', { infer: true }),
      to: destinatario,
      subject: 'Urbizzi - Recuperação de senha',
      text: `Para redefinir sua senha, acesse: ${url.toString()}\nO link é válido por 1 hora e pode ser usado uma única vez. Se não solicitou, ignore este e-mail.`,
    });
  }
}
