import { getDb } from "@/lib/sqlite";
import { Character, GenerationStatus, ModelTaskType } from "@/store/characterStore";

interface CharacterRow {
  id: string;
  name: string;
  model_path: string | null;
  model_remote_url: string | null;
  model_task_type: string;
  idle_anim_path: string | null;
  sleep_anim_path: string | null;
  generation_status: string;
  meshy_task_id: string | null;
  refine_meshy_task_id: string | null;
  rig_task_id: string | null;
  idle_meshy_task_id: string | null;
  sleep_meshy_task_id: string | null;
  idle_speech_bubble: string | null;
  server_id: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    modelPath: row.model_path ?? undefined,
    modelRemoteUrl: row.model_remote_url ?? undefined,
    modelTaskType: row.model_task_type as ModelTaskType,
    idleAnimPath: row.idle_anim_path ?? undefined,
    sleepAnimPath: row.sleep_anim_path ?? undefined,
    generationStatus: row.generation_status as GenerationStatus,
    meshyTaskId: row.meshy_task_id ?? undefined,
    refineMeshyTaskId: row.refine_meshy_task_id ?? undefined,
    rigTaskId: row.rig_task_id ?? undefined,
    idleMeshyTaskId: row.idle_meshy_task_id ?? undefined,
    sleepMeshyTaskId: row.sleep_meshy_task_id ?? undefined,
    idleSpeechBubble: row.idle_speech_bubble ?? undefined,
    serverId: row.server_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at ?? undefined,
  };
}

export async function saveCharacter(
  data: Omit<Character, "id" | "createdAt" | "updatedAt">
): Promise<Character> {
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO characters
       (id, name, model_path, model_remote_url, model_task_type,
        idle_anim_path, sleep_anim_path, generation_status,
        meshy_task_id, rig_task_id, idle_meshy_task_id, sleep_meshy_task_id,
        server_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.name, data.modelPath ?? null, data.modelRemoteUrl ?? null,
      data.modelTaskType, data.idleAnimPath ?? null, data.sleepAnimPath ?? null,
      data.generationStatus, data.meshyTaskId ?? null, data.rigTaskId ?? null,
      data.idleMeshyTaskId ?? null, data.sleepMeshyTaskId ?? null,
      data.serverId ?? null, now, now,
    ]
  );

  return { id, ...data, createdAt: now, updatedAt: now };
}

export async function findFirstCharacter(): Promise<Character | null> {
  const db = await getDb();
  const rows = await db.select<CharacterRow[]>("SELECT * FROM characters LIMIT 1");
  return rows.length > 0 ? toCharacter(rows[0]) : null;
}

export async function findCharacterById(id: string): Promise<Character | null> {
  const db = await getDb();
  const rows = await db.select<CharacterRow[]>(
    "SELECT * FROM characters WHERE id = ?",
    [id]
  );
  return rows.length > 0 ? toCharacter(rows[0]) : null;
}

export async function updateCharacterName(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE characters SET name = ?, updated_at = ? WHERE id = ?",
    [name, Date.now(), id]
  );
}

export async function markCharacterSynced(id: string, serverId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE characters SET server_id = ?, synced_at = ?, updated_at = ? WHERE id = ?",
    [serverId, Date.now(), Date.now(), id]
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM characters WHERE id = ?", [id]);
}

// 폴러: 캐릭터 생성 진행 상태 업데이트
export async function updateCharacterFields(
  id: string,
  fields: Partial<Pick<Character,
    "modelPath" | "modelRemoteUrl" | "idleAnimPath" | "sleepAnimPath" |
    "generationStatus" | "rigTaskId" | "refineMeshyTaskId" | "idleMeshyTaskId" | "sleepMeshyTaskId">>
): Promise<void> {
  const db = await getDb();
  const map: Record<string, string> = {
    modelPath: "model_path",
    modelRemoteUrl: "model_remote_url",
    idleAnimPath: "idle_anim_path",
    sleepAnimPath: "sleep_anim_path",
    generationStatus: "generation_status",
    rigTaskId: "rig_task_id",
    refineMeshyTaskId: "refine_meshy_task_id",
    idleMeshyTaskId: "idle_meshy_task_id",
    sleepMeshyTaskId: "sleep_meshy_task_id",
  };
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `${map[k]} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.execute(
    `UPDATE characters SET ${setClause}, updated_at = ? WHERE id = ?`,
    [...values, Date.now(), id]
  );
}

// 폴러: 아직 ready/failed가 아닌 캐릭터 조회
export async function findPendingCharacters(): Promise<Character[]> {
  const db = await getDb();
  const rows = await db.select<CharacterRow[]>(
    "SELECT * FROM characters WHERE generation_status = 'pending'"
  );
  return rows.map(toCharacter);
}

export async function updateIdleSpeechBubble(id: string, text: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE characters SET idle_speech_bubble = ?, updated_at = ? WHERE id = ?",
    [text, Date.now(), id]
  );
}
