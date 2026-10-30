/**
 * Local Journey and Search Storage Service
 * 
 * Powered by expo-sqlite on-device database.
 * Strict zero-telemetry guarantee: all journeys remain local on device.
 * Provides a 1-tap hardWipeAllData() for complete privacy compliance.
 */

export interface ISQLiteDatabase {
  execAsync(source: string): Promise<any>;
  runAsync(source: string, ...params: any[]): Promise<any>;
  getAllAsync<T = any>(source: string, ...params: any[]): Promise<T[]>;
  getFirstAsync<T = any>(source: string, ...params: any[]): Promise<T | null>;
}

export interface SavedJourney {
  id: string;
  title: string;
  origin_name: string;
  origin_lat: number;
  origin_lon: number;
  dest_name: string;
  dest_lat: number;
  dest_lon: number;
  distance_m: number;
  duration_s: number;
  context_score: number;
  is_favorite: number; // 0 or 1
  created_at: string;
}

export interface RecentSearch {
  id: string;
  query: string;
  lat: number;
  lon: number;
  display_name: string;
  created_at: string;
}

let dbInstance: ISQLiteDatabase | null = null;

/**
 * Injects or overrides the active SQLite database instance (used for testing or custom paths).
 */
export function setDbInstance(db: ISQLiteDatabase | null): void {
  dbInstance = db;
}

/**
 * Initializes and returns the local SQLite database instance
 */
export async function getDb(): Promise<ISQLiteDatabase> {
  if (!dbInstance) {
    const SQLite = await import('expo-sqlite');
    dbInstance = await SQLite.openDatabaseAsync('walking_companion.db');
    await initSchema(dbInstance);
  }
  return dbInstance;
}

/**
 * Sets up database schema if tables do not exist
 */
export async function initSchema(db: ISQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS saved_journeys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      origin_name TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lon REAL NOT NULL,
      dest_name TEXT NOT NULL,
      dest_lat REAL NOT NULL,
      dest_lon REAL NOT NULL,
      distance_m REAL NOT NULL,
      duration_s REAL NOT NULL,
      context_score REAL NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_searches (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

/**
 * Saves a walking journey to local storage
 */
export async function saveJourney(journey: Omit<SavedJourney, 'created_at'>): Promise<void> {
  const db = await getDb();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO saved_journeys 
      (id, title, origin_name, origin_lat, origin_lon, dest_name, dest_lat, dest_lon, distance_m, duration_s, context_score, is_favorite, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      journey.id,
      journey.title,
      journey.origin_name,
      journey.origin_lat,
      journey.origin_lon,
      journey.dest_name,
      journey.dest_lat,
      journey.dest_lon,
      journey.distance_m,
      journey.duration_s,
      journey.context_score,
      journey.is_favorite ?? 0,
      createdAt,
    ]
  );
}

/**
 * Retrieves all saved journeys ordered by newest first
 */
export async function getSavedJourneys(): Promise<SavedJourney[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SavedJourney>(
    `SELECT * FROM saved_journeys ORDER BY is_favorite DESC, created_at DESC;`
  );
  return rows || [];
}

/**
 * Toggles the favorite status of a saved journey
 */
export async function toggleFavoriteJourney(id: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ is_favorite: number }>(
    `SELECT is_favorite FROM saved_journeys WHERE id = ?;`,
    [id]
  );
  if (!existing) return false;

  const newStatus = existing.is_favorite === 1 ? 0 : 1;
  await db.runAsync(
    `UPDATE saved_journeys SET is_favorite = ? WHERE id = ?;`,
    [newStatus, id]
  );
  return newStatus === 1;
}

/**
 * Deletes a single journey from local storage
 */
export async function deleteJourney(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM saved_journeys WHERE id = ?;`, [id]);
}

/**
 * Records a recent search
 */
export async function saveRecentSearch(search: Omit<RecentSearch, 'created_at'>): Promise<void> {
  const db = await getDb();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT OR REPLACE INTO recent_searches (id, query, lat, lon, display_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [search.id, search.query, search.lat, search.lon, search.display_name, createdAt]
  );
}

/**
 * Retrieves recent searches (up to limit)
 */
export async function getRecentSearches(limit = 5): Promise<RecentSearch[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RecentSearch>(
    `SELECT * FROM recent_searches ORDER BY created_at DESC LIMIT ?;`,
    [limit]
  );
  return rows || [];
}

/**
 * 1-Tap Hard Wipe: permanently deletes all local journey records,
 * search history, and runs SQLite VACUUM.
 */
export async function hardWipeAllData(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM saved_journeys;
    DELETE FROM recent_searches;
    VACUUM;
  `);
}

