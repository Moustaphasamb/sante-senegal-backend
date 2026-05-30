import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type {
  InitiatePaymentInput,
  PaymentWebhookInput,
  RefundInput,
  ListPaymentsQuery,
} from '../validators/payment.validators';

function getSignature(req: Request): string | undefined {
  const sig = req.headers['x-webhook-signature'];
  return Array.isArray(sig) ? sig[0] : sig;
}

class PaymentController {
  // ─── INITIER ──────────────────────────────────────────────────

  initiate = async (
    req: Request<{}, {}, InitiatePaymentInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await paymentService.initiate(req.user.userId, req.body);
      sendCreated(res, result, result.paid ? 'Paiement effectué' : 'Paiement initié');
    } catch (error) {
      next(error);
    }
  };

  // ─── WEBHOOK WAVE ─────────────────────────────────────────────

  waveWebhook = async (
    req: Request<{}, {}, PaymentWebhookInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await paymentService.handleWebhook('WAVE', req.body, getSignature(req));
      sendSuccess(res, result, { message: 'Webhook traité' });
    } catch (error) {
      next(error);
    }
  };

  // ─── WEBHOOK ORANGE MONEY ─────────────────────────────────────

  orangeMoneyWebhook = async (
    req: Request<{}, {}, PaymentWebhookInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await paymentService.handleWebhook('ORANGE_MONEY', req.body, getSignature(req));
      sendSuccess(res, result, { message: 'Webhook traité' });
    } catch (error) {
      next(error);
    }
  };

  // ─── LISTE ────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListPaymentsQuery;
      const result = await paymentService.list(req.user.userId, query);
      sendSuccess(res, result.payments, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── DÉTAIL ───────────────────────────────────────────────────

  getById = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const payment = await paymentService.getById(req.params.id, req.user.userId, req.user.role);
      sendSuccess(res, payment);
    } catch (error) {
      next(error);
    }
  };

  // ─── REMBOURSEMENT (admin) ────────────────────────────────────

  refund = async (
    req: Request<{ id: string }, {}, RefundInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const payment = await paymentService.refund(req.params.id, req.user.userId, req.body);
      sendSuccess(res, payment, { message: 'Remboursement effectué' });
    } catch (error) {
      next(error);
    }
  };
}

export const paymentController = new PaymentController();
