import { prisma } from '../config/database';
import { BadRequestError } from '../utils/errors';
import type { ListAuditLogsQuery } from '../validators/audit.validators';

const AUDIT_INCLUDE = {
  user: { select: { firstName: true, lastName: true, role: true, phoneNumber: true } },
} as const;

// ═══════════════════════════════════════════════════════════════════
// Service Audit (lecture — réservé super-admin)
// ═══════════════════════════════════════════════════════════════════

class AuditService {
  // ─── LISTE FILTRÉE ────────────────────────────────────────────

  async list(query: ListAuditLogsQuery) {
    const { page, limit, userId, action, resourceType, resourceId, from, to } = query;
    if (from && to && from > to) {
      throw new BadRequestError('La date de début doit précéder la date de fin');
    }
    const skip = (page - 1) * limit;

    const where = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(resourceType && { resourceType }),
      ...(resourceId && { resourceId }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: AUDIT_INCLUDE,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── HISTORIQUE D'UNE RESSOURCE ───────────────────────────────

  async resourceHistory(resourceType: string, resourceId: string) {
    const logs = await prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { createdAt: 'asc' },
      include: AUDIT_INCLUDE,
    });
    return logs;
  }
}

export const auditService = new AuditService();
