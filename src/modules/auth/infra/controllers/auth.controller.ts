import { RecuperacaoSenhaService } from '../../application/services/recuperacao-senha.service.js';
import { ForgotPasswordDto } from '../../application/dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../../application/dto/reset-password.dto.js';
import { ApiAcceptedResponse } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  Header,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../../shared/infra/auth/public.decorator.js';
import { CurrentUser } from '../../../../shared/infra/auth/current-user.decorator.js';
import { ApiErrorResponses } from '../../../../shared/infra/http/swagger/api-error-responses.decorator.js';
import { AuthService } from '../../application/services/auth.service.js';
import { LoginDto } from '../../application/dto/login.dto.js';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto.js';
import { TokensDto } from '../../application/dto/tokens.dto.js';
import { UsuarioLogadoDto } from '../../application/dto/usuario-logado.dto.js';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly recuperacao: RecuperacaoSenhaService,
  ) {}
  /** Solicita um link de recuperação sem revelar se a conta existe */
  @Public()
  @Post('forgot-password')
  @HttpCode(202)
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  @ApiAcceptedResponse({
    description:
      'Se o e-mail estiver cadastrado e ativo, enviaremos as instruções de recuperação.',
  })
  @ApiErrorResponses(400, 429)
  solicitar(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.recuperacao.solicitar(dto.email);
  }
  /** Redefine a senha e revoga os refresh tokens anteriores */
  @Public()
  @Post('reset-password')
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  @ApiNoContentResponse({
    description: 'Senha redefinida; faça login novamente',
  })
  @ApiErrorResponses(400, 401, 429)
  redefinir(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.recuperacao.redefinir(dto.token, dto.senha);
  }
  /** Autentica o usuário e inicia uma sessão */
  @Public()
  @ApiOkResponse({ type: TokensDto })
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(400, 401, 429)
  login(@Body() dto: LoginDto): Promise<TokensDto> {
    return this.auth.login(dto);
  }
  /** Renova os tokens e invalida o refresh token anterior */
  @Public()
  @ApiOkResponse({ type: TokensDto })
  @Post('refresh')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(400, 401, 429)
  refresh(@Body() dto: RefreshTokenDto): Promise<TokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }
  /** Revoga o refresh token informado */
  @Public()
  @ApiNoContentResponse({ description: 'Refresh token revogado' })
  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(400)
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }
  /** Consulta os dados e o perfil atuais do usuário autenticado */
  @ApiOkResponse({ type: UsuarioLogadoDto })
  @Get('me')
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiErrorResponses(401)
  async me(
    @CurrentUser() usuario: UsuarioLogadoDto,
  ): Promise<UsuarioLogadoDto> {
    return usuario;
  }
}
