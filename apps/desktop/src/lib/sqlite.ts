import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:desktop-figures.db");
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id                TEXT PRIMARY KEY,
      name              TEXT NOT NULL,
      base_image_path   TEXT NOT NULL,
      sleep_image_path  TEXT NOT NULL,
      server_id         TEXT,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      synced_at         INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actions (
      id                TEXT PRIMARY KEY,
      character_id      TEXT NOT NULL REFERENCES characters(id),
      name              TEXT NOT NULL,
      action_image_path TEXT NOT NULL,
      speech_bubble     TEXT,
      voice_file_path   TEXT,
      voice_loop_start  INTEGER,
      voice_loop_end    INTEGER,
      scheduled_at      INTEGER,
      duration_minutes  INTEGER,
      server_id         TEXT,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL,
      synced_at         INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id           TEXT PRIMARY KEY,
      email        TEXT NOT NULL,
      nickname     TEXT NOT NULL,
      access_token TEXT,
      created_at   INTEGER NOT NULL
    )
  `);
}
