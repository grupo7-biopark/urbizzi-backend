import { IsString, Matches } from 'class-validator';
export class RefreshTokenDto {
  /** Refresh token recebido no login ou na última renovação. @example 'token-base64url-com-43-caracteres' */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refreshToken: string;
}
