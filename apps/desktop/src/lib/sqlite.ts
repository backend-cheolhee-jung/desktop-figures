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
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      model_path          TEXT,
      model_remote_url    TEXT,
      model_task_type     TEXT NOT NULL DEFAULT 'text',
      idle_anim_path      TEXT,
      sleep_anim_path     TEXT,
      generation_status   TEXT NOT NULL DEFAULT 'pending',
      meshy_task_id       TEXT,
      idle_meshy_task_id  TEXT,
      sleep_meshy_task_id TEXT,
      rig_task_id         TEXT,
      server_id           TEXT,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      synced_at           INTEGER
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS actions (
      id                TEXT PRIMARY KEY,
      character_id      TEXT NOT NULL REFERENCES characters(id),
      name              TEXT NOT NULL,
      animation_path    TEXT,
      generation_status TEXT NOT NULL DEFAULT 'pending',
      meshy_task_id     TEXT,
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

  await migrateColumns(db);
}

async function migrateColumns(db: Database): Promise<void> {
  const ensure = async (
    table: string,
    column: string,
    definition: string
  ): Promise<void> => {
    const cols = await db.select<{ name: string }[]>(
      `PRAGMA table_info(${table})`
    );
    if (!cols.some((c) => c.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // 기존 2D 캐릭터 데이터는 재생성 유도를 위해 failed로 표시
  await ensure("characters", "model_path", "TEXT");
  await ensure("characters", "model_remote_url", "TEXT");
  await ensure("characters", "model_task_type", "TEXT NOT NULL DEFAULT 'text'");
  await ensure("characters", "idle_anim_path", "TEXT");
  await ensure("characters", "sleep_anim_path", "TEXT");
  await ensure("characters", "generation_status", "TEXT NOT NULL DEFAULT 'pending'");
  await ensure("characters", "meshy_task_id", "TEXT");
  await ensure("characters", "idle_meshy_task_id", "TEXT");
  await ensure("characters", "sleep_meshy_task_id", "TEXT");
  await ensure("characters", "rig_task_id", "TEXT");

  await ensure("actions", "animation_path", "TEXT");
  await ensure("actions", "generation_status", "TEXT NOT NULL DEFAULT 'pending'");
  await ensure("actions", "meshy_task_id", "TEXT");
  await ensure("characters", "idle_speech_bubble", "TEXT");

  // 기존 2D 레코드(model_path NULL이지만 status가 기본 pending) → failed 처리
  await db.execute(
    `UPDATE characters SET generation_status = 'failed'
     WHERE model_path IS NULL AND base_image_path IS NOT NULL`
  ).catch(() => {});
  await db.execute(
    `UPDATE actions SET generation_status = 'failed'
     WHERE animation_path IS NULL AND action_image_path IS NOT NULL`
  ).catch(() => {});
}
