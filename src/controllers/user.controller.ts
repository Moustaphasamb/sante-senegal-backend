import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { UnauthorizedError, BadRequestError } from '../utils/errors';
import type {
  UpdateUserProfileInput,
  CreateEmergencyContactInput,
  UpdateEmergencyContactInput,
} from '../validators/user.validators';

class UserController {
  // ─── PROFIL CONNECTÉ ─────────────────────────────────────────────

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const user = await userService.getMe(req.user.userId);
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (
    req: Request<{}, {}, UpdateUserProfileInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const updated = await userService.updateProfile(req.user.userId, req.body);
      sendSuccess(res, updated, { message: 'Profil mis à jour avec succès' });
    } catch (error) {
      next(error);
    }
  };

  // ─── PHOTO DE PROFIL ─────────────────────────────────────────────

  uploadPhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();

      if (!req.file) {
        throw new BadRequestError('Aucun fichier envoyé. Champ requis : "photo"');
      }

      const photoUrl = await userService.uploadProfilePhoto(
        req.user.userId,
        req.file.buffer,
        req.file.mimetype
      );

      sendSuccess(res, { photoUrl }, { message: 'Photo de profil mise à jour' });
    } catch (error) {
      next(error);
    }
  };

  deletePhoto = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await userService.deleteProfilePhoto(req.user.userId);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  // ─── PROFIL PUBLIC ────────────────────────────────────────────────

  getPublicProfile = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await userService.getPublicProfile(req.params.id);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  };

  // ─── SUPPRESSION COMPTE ───────────────────────────────────────────

  deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await userService.softDeleteAccount(req.user.userId);
      sendSuccess(res, null, { message: 'Votre compte a été désactivé' });
    } catch (error) {
      next(error);
    }
  };

  // ─── CONTACTS D'URGENCE ───────────────────────────────────────────

  getEmergencyContacts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const contacts = await userService.getEmergencyContacts(req.user.userId);
      sendSuccess(res, contacts);
    } catch (error) {
      next(error);
    }
  };

  addEmergencyContact = async (
    req: Request<{}, {}, CreateEmergencyContactInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const contact = await userService.addEmergencyContact(req.user.userId, req.body);
      sendCreated(res, contact, 'Contact d\'urgence ajouté');
    } catch (error) {
      next(error);
    }
  };

  updateEmergencyContact = async (
    req: Request<{ id: string }, {}, UpdateEmergencyContactInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const contact = await userService.updateEmergencyContact(
        req.user.userId,
        req.params.id,
        req.body
      );
      sendSuccess(res, contact, { message: 'Contact d\'urgence mis à jour' });
    } catch (error) {
      next(error);
    }
  };

  deleteEmergencyContact = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      await userService.deleteEmergencyContact(req.user.userId, req.params.id);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
