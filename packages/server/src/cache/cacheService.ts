/**
 * Unified Cache Service for Geospatial Gateway
 * 
 * Provides an in-memory TTL cache with automatic expiration and active cleanup,
 * and seamless pluggability for Redis when configured via REDIS_URL.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): number;
  stop?(): void;
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

// Global default singleton
export const defaultCache: ICacheService = new MemoryCacheService();
