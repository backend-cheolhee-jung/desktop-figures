import { getDb } from "@/lib/sqlite";
import { Character } from "@/store/characterStore";

interface CharacterRow {
  id: string;
  name: string;
  base_image_path: string;
  sleep_image_path: string;
  server_id: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
}

function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    baseImagePath: row.base_image_path,
    sleepImagePath: row.sleep_image_path,
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
       (id, name, base_image_path, sleep_image_path, server_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.name, data.baseImagePath, data.sleepImagePath, data.serverId ?? null, now, now]
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
