import { Request, Response, NextFunction } from 'express';
import { walletService } from '../services/wallet.service';
import { sendSuccess } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import type { ListWalletTransactionsQuery, WithdrawInput } from '../validators/wallet.validators';

class WalletController {
  // ─── SOLDE ────────────────────────────────────────────────────

  getMyWallet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const wallet = await walletService.getMyWallet(req.user.userId);
      sendSuccess(res, wallet);
    } catch (error) {
      next(error);
    }
  };

  // ─── HISTORIQUE ───────────────────────────────────────────────

  listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const query = req.query as unknown as ListWalletTransactionsQuery;
      const result = await walletService.listTransactions(req.user.userId, query);
      sendSuccess(res, result.transactions, { meta: result.meta });
    } catch (error) {
      next(error);
    }
  };

  // ─── RETRAIT ──────────────────────────────────────────────────

  withdraw = async (
    req: Request<{}, {}, WithdrawInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) throw new UnauthorizedError();
      const result = await walletService.withdraw(req.user.userId, req.body);
      sendSuccess(res, result, { message: 'Retrait enregistré' });
    } catch (error) {
      next(error);
    }
  };
}

export const walletController = new WalletController();
