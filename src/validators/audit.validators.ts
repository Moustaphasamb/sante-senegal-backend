import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════
// LISTE DES LOGS D'AUDIT (GET /admin/audit-logs)
// ═══════════════════════════════════════════════════════════════════

export const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().optional(),
  action: z.string().max(100).optional(),
  resourceType: z.string().max(100).optional(),
  resourceId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ═══════════════════════════════════════════════════════════════════
// TYPES INFÉRÉS
// ═══════════════════════════════════════════════════════════════════

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsSchema>;
