import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  CreateReviewInput,
  RespondReviewInput,
  ModerateReviewInput,
  ListReviewsQuery,
} from '../validators/review.validators';

class ReviewController {
  // ─── CRÉER ────────────────────────────────────────────────────

  create = async (
    req: Request<{}, {}, CreateReviewInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const review = await reviewService.create(req.user.userId, req.body);
      sendCreated(res, review, 'Avis publié');
    } catch (error) {
      next(error);
    }
  };

  // ─── AVIS SUR UN UTILISATEUR ──────────────────────────────────

  listForTarget = async (
    req: Request<{ userId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = req.query as unknown as ListReviewsQuery;
      const result = await reviewService.listForTarget(req.params.userId, query);
      sendSuccess(res, result.reviews, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── MES AVIS REÇUS ───────────────────────────────────────────

  myReceived = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListReviewsQuery;
      const result = await reviewService.myReceived(req.user.userId, query);
      sendSuccess(res, result.reviews, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── RÉPONDRE ─────────────────────────────────────────────────

  respond = async (
    req: Request<{ id: string }, {}, RespondReviewInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const review = await reviewService.respond(req.params.id, req.user.userId, req.body);
      sendSuccess(res, review, { message: 'Réponse enregistrée' });
    } catch (error) {
      next(error);
    }
  };

  // ─── MODÉRER (admin) ──────────────────────────────────────────

  moderate = async (
    req: Request<{ id: string }, {}, ModerateReviewInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const review = await reviewService.moderate(req.params.id, req.user.userId, req.body);
      sendSuccess(res, review, { message: 'Avis modéré' });
    } catch (error) {
      next(error);
    }
  };
}

export const reviewController = new ReviewController();
