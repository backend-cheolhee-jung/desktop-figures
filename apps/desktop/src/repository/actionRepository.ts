import { getDb } from "@/lib/sqlite";
import { Action } from "@/store/actionStore";

interface ActionRow {
  id: string;
  character_id: string;
  name: string;
  action_image_path: string;
  speech_bubble: string | null;
  voice_file_path: string | null;
  voice_loop_start: number | null;
  voice_loop_end: number | null;
  scheduled_at: number | null;
  duration_minutes: number | null;
  server_id: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    characterId: row.character_id,
    name: row.name,
    actionImagePath: row.action_image_path,
    speechBubble: row.speech_bubble ?? undefined,
    voiceFilePath: row.voice_file_path ?? undefined,
    voiceLoopStart: row.voice_loop_start ?? undefined,
    voiceLoopEnd: row.voice_loop_end ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
  };
}

export async function saveAction(
  data: Omit<Action, "id" | "createdAt" | "updatedAt">
): Promise<Action> {
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO actions
       (id, character_id, name, action_image_path, speech_bubble,
        voice_file_path, voice_loop_start, voice_loop_end,
        scheduled_at, duration_minutes, server_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.characterId,
      data.name,
      data.actionImagePath,
      data.speechBubble ?? null,
      data.voiceFilePath ?? null,
      data.voiceLoopStart ?? null,
      data.voiceLoopEnd ?? null,
      data.scheduledAt ?? null,
      data.durationMinutes ?? null,
      null,
      now,
      now,
    ]
  );

  return { id, ...data, createdAt: now, updatedAt: now };
}

export async function findActionsByCharacterId(characterId: string): Promise<Action[]> {
  const db = await getDb();
  const rows = await db.select<ActionRow[]>(
    "SELECT * FROM actions WHERE character_id = ? ORDER BY created_at ASC",
    [characterId]
  );
  return rows.map(toAction);
}

export async function findActionById(id: string): Promise<Action | null> {
  const db = await getDb();
  const rows = await db.select<ActionRow[]>(
    "SELECT * FROM actions WHERE id = ?",
    [id]
  );
  return rows.length > 0 ? toAction(rows[0]) : null;
}

export async function findScheduledActions(from: number, to: number): Promise<Action[]> {
  const db = await getDb();
  const rows = await db.select<ActionRow[]>(
    "SELECT * FROM actions WHERE scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at ASC",
    [from, to]
  );
  return rows.map(toAction);
}

export async function updateSpeechBubble(id: string, text: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE actions SET speech_bubble = ?, updated_at = ? WHERE id = ?",
    [text, Date.now(), id]
  );
}

export async function updateActionSchedule(
  id: string,
  scheduledAt: number,
  durationMinutes: number
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE actions SET scheduled_at = ?, duration_minutes = ?, updated_at = ? WHERE id = ?",
    [scheduledAt, durationMinutes, Date.now(), id]
  );
}

export async function markActionSynced(id: string, serverId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE actions SET server_id = ?, synced_at = ?, updated_at = ? WHERE id = ?",
    [serverId, Date.now(), Date.now(), id]
  );
}

export async function deleteAction(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM actions WHERE id = ?", [id]);
}
