/**
 * Unified Cache Service for Geospatial Gateway
 * 
 * Provides an in-memory L1 TTL cache with automatic expiration, and seamless L2
 * Redis multi-tier caching when configured via REDIS_URL.
 * 
 * Telemetry accurately reports active cache tier and Redis connectivity status.
 */

import Redis from 'ioredis';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheTelemetry {
  tier: 'in-memory-l1' | 'multi-tier-redis-l2';
  redisConnected: boolean;
  l1Entries: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
  getStatus(): CacheTelemetry;
  stop?(): Promise<void> | void;
}

export class MemoryCacheService implements ICacheService {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;

    // Periodically sweep expired entries every 60s to prevent memory accumulation
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired();
    }, 60000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    // Evict oldest if reaching capacity
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  getStatus(): CacheTelemetry {
    return {
      tier: 'in-memory-l1',
      redisConnected: false,
      l1Entries: this.store.size,
    };
  }

  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export class MultiTierCacheService implements ICacheService {
  private l1: MemoryCacheService;
  private redis: Redis | null = null;
  private isRedisConnected = false;

  constructor(redisUrl?: string, maxL1Entries = 5000) {
    this.l1 = new MemoryCacheService(maxL1Entries);

    if (redisUrl && redisUrl.trim()) {
      try {
        this.redis = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          retryStrategy: (times) => Math.min(times * 1000, 5000),
        });

        this.redis.on('connect', () => {
          this.isRedisConnected = true;
        });

        this.redis.on('ready', () => {
          this.isRedisConnected = true;
        });

        this.redis.on('error', () => {
          this.isRedisConnected = false;
        });

        this.redis.on('close', () => {
          this.isRedisConnected = false;
        });

        // Non-blocking initial connection
        this.redis.connect().catch(() => {
          this.isRedisConnected = false;
        });
      } catch {
        this.redis = null;
        this.isRedisConnected = false;
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // 1. Fast L1 in-memory lookup
    const l1Hit = await this.l1.get<T>(key);
    if (l1Hit !== null) {
      return l1Hit;
    }

    // 2. L2 Redis lookup if available
    if (this.redis && this.isRedisConnected) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw) as T;
          // Populate L1 with remaining/default TTL
          await this.l1.set(key, parsed, 120);
          return parsed;
        }
      } catch {
        // Fall back gracefully to null on Redis read errors
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    // Always write to L1
    await this.l1.set(key, value, ttlSeconds);

    // Replicate to L2 Redis if available
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      } catch {
        // Degrade gracefully on Redis write errors
      }
    }
  }

  async del(key: string): Promise<void> {
    await this.l1.del(key);
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.del(key);
      } catch {}
    }
  }

  async clear(): Promise<void> {
    await this.l1.clear();
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.flushdb();
      } catch {}
    }
  }

  size(): number {
    return this.l1.size();
  }

  getStatus(): CacheTelemetry {
    return {
      tier: this.redis ? 'multi-tier-redis-l2' : 'in-memory-l1',
      redisConnected: this.isRedisConnected,
      l1Entries: this.l1.size(),
    };
  }

  async stop(): Promise<void> {
    this.l1.stop();
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {}
      this.redis = null;
      this.isRedisConnected = false;
    }
  }
}

/**
 * Factory creating appropriate cache provider based on configuration.
 */
export function createCacheService(redisUrl = process.env.REDIS_URL): ICacheService {
  if (redisUrl && redisUrl.trim()) {
    return new MultiTierCacheService(redisUrl);
  }
  return new MemoryCacheService();
}

// Global default singleton initialized from environment
export const defaultCache: ICacheService = createCacheService();
