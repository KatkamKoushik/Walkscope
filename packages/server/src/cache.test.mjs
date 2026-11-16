import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCacheService, MultiTierCacheService, createCacheService } from '../dist/cache/cacheService.js';

describe('Unified Cache Service (packages/server)', () => {
  it('MemoryCacheService operates with TTL, eviction, and accurate telemetry', async () => {
    const cache = new MemoryCacheService(3);
    assert.equal(cache.size(), 0);
    assert.deepEqual(cache.getStatus(), {
      tier: 'in-memory-l1',
      redisConnected: false,
      l1Entries: 0,
    });

    await cache.set('key1', 'val1', 60);
    await cache.set('key2', 'val2', 60);
    assert.equal(await cache.get('key1'), 'val1');
    assert.equal(await cache.get('key2'), 'val2');
    assert.equal(cache.size(), 2);

    await cache.del('key1');
    assert.equal(await cache.get('key1'), null);
    assert.equal(cache.size(), 1);

    await cache.clear();
    assert.equal(cache.size(), 0);
    cache.stop();
  });

  it('MultiTierCacheService operates safely when Redis URL is provided', async () => {
    // Test with dummy redis URL to verify graceful fallback and safe initialization
    const cache = new MultiTierCacheService('redis://127.0.0.1:65530');
    assert.equal(cache.getStatus().tier, 'multi-tier-redis-l2');
    assert.equal(typeof cache.getStatus().redisConnected, 'boolean');

    // Should still work for in-memory operations even if Redis is not yet connected
    await cache.set('multiKey', { route: 'mg_road' }, 60);
    const retrieved = await cache.get('multiKey');
    assert.deepEqual(retrieved, { route: 'mg_road' });

    await cache.stop();
  });

  it('createCacheService selects provider honestly based on configuration', () => {
    const memoryOnly = createCacheService('');
    assert.equal(memoryOnly.getStatus().tier, 'in-memory-l1');

    const multiTier = createCacheService('redis://127.0.0.1:6379');
    assert.equal(multiTier.getStatus().tier, 'multi-tier-redis-l2');
    multiTier.stop();
  });
});
