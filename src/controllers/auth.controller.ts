import { Request, Response, NextFunction } from 'express';
import { authService, RegisterPatientInput, RegisterMedecinInput } from '../services/auth.service';
import { otpService } from '../services/otp.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import {
  SendOtpInput,
  VerifyOtpInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
  ChangePasswordInput,
  ResetPasswordInput,
} from '../validators/auth.validators';
import { UnauthorizedError } from '../utils/errors';

class AuthController {
  // ─── OTP ─────────────────────────────────────────────────
  sendOtp = async (
    req: Request<{}, {}, SendOtpInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { phoneNumber, purpose } = req.body;
      const result = await otpService.sendOtp(phoneNumber, purpose);
      sendSuccess(res, result, { message: result.message });
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (
    req: Request<{}, {}, VerifyOtpInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { phoneNumber, code, purpose } = req.body;
      const result = await otpService.verifyOtp(phoneNumber, code, purpose);
      sendSuccess(res, result, { message: 'Code OTP valide' });
    } catch (error) {
      next(error);
    }
  };

  // ─── INSCRIPTION ─────────────────────────────────────────
  registerPatient = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await authService.registerPatient(req.body as RegisterPatientInput);
      sendCreated(res, result, 'Inscription patient réussie');
    } catch (error) {
      next(error);
    }
  };

  registerMedecin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await authService.registerMedecin(req.body as RegisterMedecinInput);
      sendCreated(
        res,
        result,
        'Inscription réussie. Votre compte sera vérifié sous 24-48h par notre équipe.'
      );
    } catch (error) {
      next(error);
    }
  };

  // ─── LOGIN ───────────────────────────────────────────────
  login = async (
    req: Request<{}, {}, LoginInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await authService.login({
        phoneNumber: req.body.phoneNumber,
        password: req.body.password,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      sendSuccess(res, result, { message: 'Connexion réussie' });
    } catch (error) {
      next(error);
    }
  };

  // ─── REFRESH ─────────────────────────────────────────────
  refresh = async (
    req: Request<{}, {}, RefreshTokenInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await authService.refreshTokens(req.body.refreshToken);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  // ─── LOGOUT ──────────────────────────────────────────────
  logout = async (
    req: Request<{}, {}, LogoutInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await authService.logout(req.body.refreshToken);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await authService.logoutAllDevices(req.user.userId);
      sendSuccess(res, { message: 'Déconnecté de tous les appareils' });
    } catch (error) {
      next(error);
    }
  };

  // ─── ME ──────────────────────────────────────────────────
  me = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const user = await authService.getMe(req.user.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  };

  // ─── CHANGEMENT MOT DE PASSE ─────────────────────────────
  changePassword = async (
    req: Request<{}, {}, ChangePasswordInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await authService.changePassword(
        req.user.userId,
        req.body.currentPassword,
        req.body.newPassword
      );
      sendSuccess(res, {
        message: 'Mot de passe changé. Veuillez vous reconnecter.',
      });
    } catch (error) {
      next(error);
    }
  };

  // ─── RESET MOT DE PASSE ──────────────────────────────────
  resetPassword = async (
    req: Request<{}, {}, ResetPasswordInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await authService.resetPassword(
        req.body.phoneNumber,
        req.body.otpCode,
        req.body.newPassword
      );
      sendSuccess(res, {
        message: 'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
