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
  pollTextModel,
  createRig,
  pollRig,
  pollAnimation,
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
    // 단계 1: text-to-3d 폴링 → 완료 시 base GLB 다운로드 + rig 요청
    if (c.meshyTaskId && !c.modelPath) {
      const r = await pollTextModel(c.meshyTaskId);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded" && r.glbUrl) {
        const path = await downloadGlb(r.glbUrl, `models/${c.id}`, "base.glb");
        const rigTaskId = await createRig(r.glbUrl);
        await updateCharacterFields(c.id, {
          modelPath: path,
          modelRemoteUrl: r.glbUrl,
          rigTaskId,
        });
        changed = true;
      }
      continue;
    }

    // 단계 2: rig 폴링 → 완료 시 walking GLB(idle) + rigged GLB(sleep) 저장
    if (c.rigTaskId && !c.idleAnimPath) {
      const r = await pollRig(c.rigTaskId);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded") {
        const fields: Parameters<typeof updateCharacterFields>[1] = {};

        if (r.walkingGlbUrl) {
          fields.idleAnimPath = await downloadGlb(r.walkingGlbUrl, `models/${c.id}`, "idle.glb");
        }
        if (r.riggedGlbUrl) {
          fields.sleepAnimPath = await downloadGlb(r.riggedGlbUrl, `models/${c.id}`, "sleep.glb");
        }

        if ((fields.idleAnimPath || c.idleAnimPath) && (fields.sleepAnimPath || c.sleepAnimPath)) {
          fields.generationStatus = "ready";
        }

        await updateCharacterFields(c.id, fields);
        changed = true;
      }
      continue;
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
    const r = await pollAnimation(a.meshyTaskId);
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
