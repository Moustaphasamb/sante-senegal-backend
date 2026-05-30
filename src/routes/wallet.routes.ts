import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { walletController } from '../controllers/wallet.controller';
import { authenticate, authorize } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { listWalletTransactionsSchema, withdrawSchema } from '../validators/wallet.validators';

const router = Router();

/**
 * GET /wallet/me
 * Solde de mon portefeuille
 */
router.get('/me', authenticate, walletController.getMyWallet);

/**
 * GET /wallet/me/transactions
 * Historique paginé de mes transactions
 */
router.get(
  '/me/transactions',
  authenticate,
  validateQuery(listWalletTransactionsSchema),
  walletController.listTransactions
);

/**
 * POST /wallet/me/withdraw
 * Demander un retrait (professionnels qui perçoivent des revenus)
 */
router.post(
  '/me/withdraw',
  authenticate,
  authorize(
    UserRole.MEDECIN_SALARIE,
    UserRole.MEDECIN_LIBERAL_MOBILE,
    UserRole.SPECIALISTE_CABINET,
    UserRole.INFIRMIER_DOMICILE,
    UserRole.PHARMACIEN,
    UserRole.LIVREUR
  ),
  validateBody(withdrawSchema),
  walletController.withdraw
);

export { router as walletRoutes };
