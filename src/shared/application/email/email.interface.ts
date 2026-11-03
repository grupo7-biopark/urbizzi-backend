export const EMAIL = Symbol('EMAIL');
export interface Email {
  enviarRecuperacao(destinatario: string, token: string): Promise<void>;
}
