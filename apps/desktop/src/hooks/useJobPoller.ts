import { useEffect, useRef } from "react";
import {
  findPendingCharacters,
  updateCharacterFields,
  findFirstCharacter,
} from "@/repository/characterRepository";
import {
  findPendingActions,
  updateActionFields,
  findActionsByCharacterId,
} from "@/repository/actionRepository";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import {
  pollTask,
  createAnimation,
  IDLE_PROMPT,
  SLEEP_PROMPT,
} from "@/lib/meshy";
import { downloadGlb } from "@/lib/glbUtils";

const POLL_INTERVAL_MS = 15_000;

export function useJobPoller() {
  const busy = useRef(false);

  useEffect(() => {
    async function tick() {
      if (busy.current) return;
      busy.current = true;
      try {
        await pollCharacters();
        await pollActions();
      } catch (e) {
        console.error("jobPoller error:", e);
      } finally {
        busy.current = false;
      }
    }

    const id = setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => clearInterval(id);
  }, []);
}

async function pollCharacters(): Promise<void> {
  const chars = await findPendingCharacters();
  let changed = false;

  for (const c of chars) {
    // 단계 1: base model
    if (c.meshyTaskId && !c.modelPath) {
      const r = await pollTask(c.meshyTaskId, c.modelTaskType);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded" && r.glbUrl) {
        const path = await downloadGlb(r.glbUrl, `models/${c.id}`, "base.glb");
        const idleTask = await createAnimation(r.glbUrl, IDLE_PROMPT);
        const sleepTask = await createAnimation(r.glbUrl, SLEEP_PROMPT);
        await updateCharacterFields(c.id, {
          modelPath: path,
          modelRemoteUrl: r.glbUrl,
          idleMeshyTaskId: idleTask,
          sleepMeshyTaskId: sleepTask,
        });
        changed = true;
      }
      continue;
    }

    // 단계 2: idle / sleep 애니메이션
    const fields: Parameters<typeof updateCharacterFields>[1] = {};
    if (c.idleMeshyTaskId && !c.idleAnimPath) {
      const r = await pollTask(c.idleMeshyTaskId, "animation");
      if (r.status === "succeeded" && r.glbUrl) {
        fields.idleAnimPath = await downloadGlb(r.glbUrl, `models/${c.id}`, "idle.glb");
      } else if (r.status === "failed") {
        fields.generationStatus = "failed";
      }
    }
    if (c.sleepMeshyTaskId && !c.sleepAnimPath) {
      const r = await pollTask(c.sleepMeshyTaskId, "animation");
      if (r.status === "succeeded" && r.glbUrl) {
        fields.sleepAnimPath = await downloadGlb(r.glbUrl, `models/${c.id}`, "sleep.glb");
      } else if (r.status === "failed") {
        fields.generationStatus = "failed";
      }
    }

    // 단계 3: 둘 다 완료 시 ready
    const idleDone = c.idleAnimPath || fields.idleAnimPath;
    const sleepDone = c.sleepAnimPath || fields.sleepAnimPath;
    if (idleDone && sleepDone && fields.generationStatus !== "failed") {
      fields.generationStatus = "ready";
    }

    if (Object.keys(fields).length > 0) {
      await updateCharacterFields(c.id, fields);
      changed = true;
    }
  }

  if (changed) {
    const fresh = await findFirstCharacter();
    useCharacterStore.getState().setCharacter(fresh);
  }
}

async function pollActions(): Promise<void> {
  const actions = await findPendingActions();
  let changed = false;

  for (const a of actions) {
    if (!a.meshyTaskId) continue;
    const r = await pollTask(a.meshyTaskId, "animation");
    if (r.status === "succeeded" && r.glbUrl) {
      const path = await downloadGlb(r.glbUrl, "models/actions", `${a.id}.glb`);
      await updateActionFields(a.id, {
        animationPath: path,
        generationStatus: "ready",
      });
      changed = true;
    } else if (r.status === "failed") {
      await updateActionFields(a.id, { generationStatus: "failed" });
      changed = true;
    }
  }

  if (changed) {
    const character = useCharacterStore.getState().character;
    if (character) {
      const fresh = await findActionsByCharacterId(character.id);
      useActionStore.getState().setActions(fresh);
    }
  }
}
