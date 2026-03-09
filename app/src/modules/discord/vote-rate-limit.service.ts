import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

const VOTE_RATE_LIMIT_TTL_MS = 3000;
const KEY_PREFIX = 'vote_rate_limit';

@Injectable()
export class VoteRateLimitService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async tryAcquire(companyId: string, userId: string, suggestionId: string): Promise<boolean> {
    const key = `${KEY_PREFIX}:${companyId}:${userId}:${suggestionId}`;
    const existing = await this.cache.get<string>(key);
    if (existing !== undefined && existing !== null) {
      return false;
    }
    await this.cache.set(key, '1', VOTE_RATE_LIMIT_TTL_MS);
    return true;
  }
}
