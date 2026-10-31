import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setDbInstance,
  initSchema,
  saveJourney,
  getSavedJourneys,
  toggleFavoriteJourney,
  deleteJourney,
  saveRecentSearch,
  getRecentSearches,
  hardWipeAllData,
} from './storageService.js';

function createInMemoryDb() {
  let hasTables = false;
  const savedJourneys = new Map();
  const recentSearches = new Map();

  return {
    async execAsync(sql) {
      if (sql.includes('CREATE TABLE')) {
        hasTables = true;
      }
      if (sql.includes('DELETE FROM saved_journeys')) {
        savedJourneys.clear();
      }
      if (sql.includes('DELETE FROM recent_searches')) {
        recentSearches.clear();
      }
      return Promise.resolve();
    },
    async runAsync(sql, ...params) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (sql.includes('INSERT OR REPLACE INTO saved_journeys')) {
        const [
          id, title, origin_name, origin_lat, origin_lon,
          dest_name, dest_lat, dest_lon, distance_m, duration_s,
          context_score, is_favorite, created_at
        ] = flatParams;
        savedJourneys.set(id, {
          id, title, origin_name, origin_lat, origin_lon,
          dest_name, dest_lat, dest_lon, distance_m, duration_s,
          context_score, is_favorite, created_at
        });
      } else if (sql.includes('UPDATE saved_journeys SET is_favorite = ? WHERE id = ?')) {
        const [newStatus, id] = flatParams;
        const j = savedJourneys.get(id);
        if (j) {
          j.is_favorite = newStatus;
        }
      } else if (sql.includes('DELETE FROM saved_journeys WHERE id = ?')) {
        const [id] = flatParams;
        savedJourneys.delete(id);
      } else if (sql.includes('INSERT OR REPLACE INTO recent_searches')) {
        const [id, query, lat, lon, display_name, created_at] = flatParams;
        recentSearches.set(id, { id, query, lat, lon, display_name, created_at });
      }
      return Promise.resolve();
    },
    async getAllAsync(sql, ...params) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (sql.includes('sqlite_master')) {
        if (!hasTables) return [];
        return [{ name: 'saved_journeys' }, { name: 'recent_searches' }];
      }
      if (sql.includes('saved_journeys')) {
        const arr = Array.from(savedJourneys.values());
        arr.sort((a, b) => {
          if (b.is_favorite !== a.is_favorite) {
            return b.is_favorite - a.is_favorite;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return arr;
      }
      if (sql.includes('recent_searches')) {
        const limit = flatParams[0] || 5;
        const arr = Array.from(recentSearches.values());
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return arr.slice(0, limit);
      }
      return [];
    },
    async getFirstAsync(sql, ...params) {
      const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
      if (sql.includes('SELECT is_favorite FROM saved_journeys WHERE id = ?')) {
        const [id] = flatParams;
        const j = savedJourneys.get(id);
        return j ? { is_favorite: j.is_favorite } : null;
      }
      return null;
    },
  };
}

describe('storageService (SQLite Local Storage & Zero-Telemetry Privacy)', () => {
  let db;

  beforeEach(async () => {
    db = createInMemoryDb();
    setDbInstance(db);
    await initSchema(db);
  });

  describe('schema initialization and migrations', () => {
    it('initializes saved_journeys and recent_searches tables', async () => {
      const tables = await db.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('saved_journeys', 'recent_searches');"
      );
      assert.equal(tables.length, 2);
      const names = tables.map((t) => t.name).sort();
      assert.deepEqual(names, ['recent_searches', 'saved_journeys']);
    });

    it('is idempotent and supports re-running initSchema without throwing or corrupting data', async () => {
      await saveJourney({
        id: 'test-1',
        title: 'Work to Home',
        origin_name: 'Origin A',
        origin_lat: 12.975,
        origin_lon: 77.605,
        dest_name: 'Dest B',
        dest_lat: 12.980,
        dest_lon: 77.610,
        distance_m: 850,
        duration_s: 600,
        context_score: 45,
        is_favorite: 1,
      });

      // Second migration pass
      await initSchema(db);

      const rows = await getSavedJourneys();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, 'Work to Home');
    });
  });

  describe('saved journeys and favorites', () => {
    it('saves a journey and retrieves it with correct types and timestamp', async () => {
      await saveJourney({
        id: 'j-london-1',
        title: 'Trafalgar to Covent Garden',
        origin_name: 'Trafalgar Square',
        origin_lat: 51.5080,
        origin_lon: -0.1281,
        dest_name: 'Covent Garden',
        dest_lat: 51.5117,
        dest_lon: -0.1240,
        distance_m: 670,
        duration_s: 540,
        context_score: 80,
        is_favorite: 0,
      });

      const journeys = await getSavedJourneys();
      assert.equal(journeys.length, 1);
      const j = journeys[0];
      assert.equal(j.id, 'j-london-1');
      assert.equal(j.title, 'Trafalgar to Covent Garden');
      assert.equal(j.distance_m, 670);
      assert.equal(j.duration_s, 540);
      assert.equal(j.context_score, 80);
      assert.equal(j.is_favorite, 0);
      assert.ok(j.created_at);
    });

    it('sorts saved journeys with favorites first, then newest first', async () => {
      await saveJourney({
        id: 'j-1',
        title: 'Journey 1 (Normal)',
        origin_name: 'A',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'B',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 100,
        duration_s: 60,
        context_score: 10,
        is_favorite: 0,
      });

      await saveJourney({
        id: 'j-2',
        title: 'Journey 2 (Favorited)',
        origin_name: 'C',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'D',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 200,
        duration_s: 120,
        context_score: 50,
        is_favorite: 1,
      });

      const journeys = await getSavedJourneys();
      assert.equal(journeys.length, 2);
      assert.equal(journeys[0].id, 'j-2', 'Favorited journey must come first');
      assert.equal(journeys[1].id, 'j-1');
    });

    it('toggles favorite status between 0 and 1', async () => {
      await saveJourney({
        id: 'j-fav-test',
        title: 'Toggle Journey',
        origin_name: 'A',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'B',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 100,
        duration_s: 60,
        context_score: 10,
        is_favorite: 0,
      });

      // 0 -> 1
      const favResult1 = await toggleFavoriteJourney('j-fav-test');
      assert.equal(favResult1, true);
      let list = await getSavedJourneys();
      assert.equal(list[0].is_favorite, 1);

      // 1 -> 0
      const favResult2 = await toggleFavoriteJourney('j-fav-test');
      assert.equal(favResult2, false);
      list = await getSavedJourneys();
      assert.equal(list[0].is_favorite, 0);

      // Non-existent id
      const favMissing = await toggleFavoriteJourney('non-existent-id');
      assert.equal(favMissing, false);
    });

    it('deletes a single journey by id', async () => {
      await saveJourney({
        id: 'j-to-delete',
        title: 'Delete Me',
        origin_name: 'A',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'B',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 100,
        duration_s: 60,
        context_score: 10,
      });

      await saveJourney({
        id: 'j-to-keep',
        title: 'Keep Me',
        origin_name: 'A',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'B',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 100,
        duration_s: 60,
        context_score: 10,
      });

      await deleteJourney('j-to-delete');

      const remaining = await getSavedJourneys();
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, 'j-to-keep');
    });
  });

  describe('recent searches', () => {
    it('saves and retrieves recent searches respecting limit', async () => {
      for (let i = 1; i <= 6; i++) {
        await saveRecentSearch({
          id: `s-${i}`,
          query: `Search ${i}`,
          lat: 12.9 + i * 0.01,
          lon: 77.6 + i * 0.01,
          display_name: `Location ${i}`,
        });
      }

      const top3 = await getRecentSearches(3);
      assert.equal(top3.length, 3);

      const top5 = await getRecentSearches(5);
      assert.equal(top5.length, 5);
    });
  });

  describe('1-tap hard wipe (hardWipeAllData)', () => {
    it('clears all saved journeys, recent searches, and leaves tables empty', async () => {
      await saveJourney({
        id: 'j-wipe-1',
        title: 'Wipe Journey',
        origin_name: 'A',
        origin_lat: 0,
        origin_lon: 0,
        dest_name: 'B',
        dest_lat: 0,
        dest_lon: 0,
        distance_m: 100,
        duration_s: 60,
        context_score: 10,
      });

      await saveRecentSearch({
        id: 's-wipe-1',
        query: 'Wipe Search',
        lat: 0,
        lon: 0,
        display_name: 'Wipe Loc',
      });

      // Execute Hard Wipe
      await hardWipeAllData();

      const remainingJourneys = await getSavedJourneys();
      const remainingSearches = await getRecentSearches();

      assert.equal(remainingJourneys.length, 0);
      assert.equal(remainingSearches.length, 0);
    });
  });

  describe('concurrency, boundary sanitization, and SQL injection resistance', () => {
    it('handles high-concurrency burst writes (50 parallel saves) without corruption', async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          saveJourney({
            id: `concurrent-${i}`,
            title: `Burst Journey ${i}`,
            origin_name: `Point ${i}`,
            origin_lat: 12.97 + i * 0.001,
            origin_lon: 77.60 + i * 0.001,
            dest_name: `Destination ${i}`,
            dest_lat: 12.98 + i * 0.001,
            dest_lon: 77.61 + i * 0.001,
            distance_m: 500 + i,
            duration_s: 300 + i,
            context_score: 50,
          })
        );
      }

      await Promise.all(promises);
      const rows = await getSavedJourneys();
      assert.equal(rows.length, 50);
    });

    it('safely neutralizes SQL injection attempts in string fields', async () => {
      const maliciousPayload = "'; DROP TABLE saved_journeys; SELECT '1";
      await saveJourney({
        id: 'sqli-test',
        title: maliciousPayload,
        origin_name: "admin' --",
        origin_lat: 12.9,
        origin_lon: 77.6,
        dest_name: "dest' OR '1'='1",
        dest_lat: 12.9,
        dest_lon: 77.6,
        distance_m: 100,
        duration_s: 100,
        context_score: 50,
      });

      const rows = await getSavedJourneys();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, maliciousPayload);
      assert.equal(rows[0].origin_name, "admin' --");
    });

    it('sanitizes NaN and out-of-range numbers into valid bounded numbers', async () => {
      await saveJourney({
        id: 'nan-test',
        title: 'NaN Route',
        origin_name: 'Origin',
        origin_lat: NaN,
        origin_lon: NaN,
        dest_name: 'Dest',
        dest_lat: 195.5, // exceeds 90
        dest_lon: -250.0, // exceeds -180
        distance_m: -50, // negative distance
        duration_s: NaN,
        context_score: 999, // exceeds 100
      });

      const rows = await getSavedJourneys();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].origin_lat, 0);
      assert.equal(rows[0].origin_lon, 0);
      assert.equal(rows[0].dest_lat, 90);
      assert.equal(rows[0].dest_lon, -180);
      assert.equal(rows[0].distance_m, 0);
      assert.equal(rows[0].context_score, 100);
    });
  });
});
