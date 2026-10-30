/**
 * Local Journey and Search Storage Service
 * 
 * Powered by expo-sqlite on-device database.
 * Strict zero-telemetry guarantee: all journeys remain local on device.
 * Provides a 1-tap hardWipeAllData() for complete privacy compliance.
 */

let dbInstance = null;

/**
 * Injects or overrides the active SQLite database instance (used for testing or custom paths).
 */
export function setDbInstance(db) {
  dbInstance = db;
}

/**
 * Initializes and returns the local SQLite database instance
 */
export async function getDb() {
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
export async function initSchema(db) {
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
export async function saveJourney(journey) {
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
export async function getSavedJourneys() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM saved_journeys ORDER BY is_favorite DESC, created_at DESC;`
  );
  return rows || [];
}

/**
 * Toggles the favorite status of a saved journey
 */
export async function toggleFavoriteJourney(id) {
  const db = await getDb();
  const existing = await db.getFirstAsync(
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
export async function deleteJourney(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM saved_journeys WHERE id = ?;`, [id]);
}

/**
 * Records a recent search
 */
export async function saveRecentSearch(search) {
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
export async function getRecentSearches(limit = 5) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM recent_searches ORDER BY created_at DESC LIMIT ?;`,
    [limit]
  );
  return rows || [];
}

/**
 * 1-Tap Hard Wipe: permanently deletes all local journey records,
 * search history, and runs SQLite VACUUM.
 */
export async function hardWipeAllData() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM saved_journeys;
    DELETE FROM recent_searches;
    VACUUM;
  `);
}
