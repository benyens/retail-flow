import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export class SessionService {
  constructor(private prisma: PrismaClient) {}
  private digest(token: string) { return createHash('sha256').update(token).digest('hex'); }
  async isRevoked(token: string) {
    return Boolean(await this.prisma.revokedToken.findUnique({ where: { tokenHash: this.digest(token) } }));
  }
  async revoke(token: string, expiresAt: Date) {
    await this.prisma.revokedToken.upsert({ where: { tokenHash: this.digest(token) },
      create: { tokenHash: this.digest(token), expiresAt }, update: {} });
    // Expired JWTs are rejected by signature verification before this lookup.
    await this.prisma.revokedToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  }
}
