import { prisma } from '../config/database';
import { logger } from './logger';

interface AuditParams {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValue?: object;
  newValue?: object;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Crée une entrée AuditLog de façon non-bloquante.
 * Ne propage jamais d'erreur — l'échec d'un audit ne doit pas
 * interrompre le flux métier principal.
 */
export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oldValue: params.oldValue as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: params.newValue as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: params.metadata as any,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    logger.error('Erreur création AuditLog (non bloquant)', { err, action: params.action });
  }
}
