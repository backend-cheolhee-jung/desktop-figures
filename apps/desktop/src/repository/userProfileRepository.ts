import { getDb } from "@/lib/sqlite";

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  accessToken?: string;
  createdAt: number;
}

interface UserProfileRow {
  id: string;
  email: string;
  nickname: string;
  access_token: string | null;
  created_at: number;
}

function toProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    accessToken: row.access_token ?? undefined,
    createdAt: row.created_at,
  };
}

export async function saveUserProfile(
  data: Omit<UserProfile, "id" | "createdAt">
): Promise<UserProfile> {
  const db = await getDb();
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO user_profile (id, email, nickname, access_token, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.email, data.nickname, data.accessToken ?? null, now]
  );

  return { id, ...data, createdAt: now };
}

export async function findUserProfile(): Promise<UserProfile | null> {
  const db = await getDb();
  const rows = await db.select<UserProfileRow[]>(
    "SELECT * FROM user_profile LIMIT 1"
  );
  return rows.length > 0 ? toProfile(rows[0]) : null;
}

export async function updateAccessToken(id: string, token: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE user_profile SET access_token = ? WHERE id = ?",
    [token, id]
  );
}

export async function deleteUserProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM user_profile WHERE id = ?", [id]);
}
