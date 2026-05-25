import { useEffect } from "react";
import { useAppStore } from "@/store/appStore";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import { getDb } from "@/lib/sqlite";
import SetupPage from "@/pages/Setup";
import MainPage from "@/pages/Main";
import SettingsPage from "@/pages/Settings";

export default function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setPage = useAppStore((s) => s.setPage);
  const setCharacter = useCharacterStore((s) => s.setCharacter);
  const setActions = useActionStore((s) => s.setActions);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();

        const characters = await db.select<
          {
            id: string;
            name: string;
            base_image_path: string;
            sleep_image_path: string;
            server_id: string | null;
            created_at: number;
            updated_at: number;
            synced_at: number | null;
          }[]
        >("SELECT * FROM characters LIMIT 1");

        if (characters.length === 0) {
          setPage("setup");
          return;
        }

        const row = characters[0];
        setCharacter({
          id: row.id,
          name: row.name,
          baseImagePath: row.base_image_path,
          sleepImagePath: row.sleep_image_path,
          serverId: row.server_id ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncedAt: row.synced_at ?? undefined,
        });

        const actions = await db.select<
          {
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
            created_at: number;
            updated_at: number;
          }[]
        >("SELECT * FROM actions WHERE character_id = ?", [row.id]);

        setActions(
          actions.map((a) => ({
            id: a.id,
            characterId: a.character_id,
            name: a.name,
            actionImagePath: a.action_image_path,
            speechBubble: a.speech_bubble ?? undefined,
            voiceFilePath: a.voice_file_path ?? undefined,
            voiceLoopStart: a.voice_loop_start ?? undefined,
            voiceLoopEnd: a.voice_loop_end ?? undefined,
            scheduledAt: a.scheduled_at ?? undefined,
            durationMinutes: a.duration_minutes ?? undefined,
            createdAt: a.created_at,
            updatedAt: a.updated_at,
          }))
        );

        setPage("main");
      } catch (e) {
        console.error("DB init error:", e);
        setPage("setup");
      }
    })();
  }, []);

  return (
    <div className="w-full h-screen bg-transparent">
      {currentPage === "setup" && <SetupPage />}
      {currentPage === "main" && <MainPage />}
      {currentPage === "settings" && <SettingsPage />}
    </div>
  );
}
