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
  saveAction,
} from "@/repository/actionRepository";
import { useCharacterStore } from "@/store/characterStore";
import { useActionStore } from "@/store/actionStore";
import {
  pollTextModel,
  createRefine,
  createRig,
  pollRig,
  createAnimation,
  pollAnimation,
  ANIMATION_PRESETS,
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
        await autoCreateMissingActions();
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
    // 단계 1: preview 폴링 → 완료 시 refine 요청
    if (c.meshyTaskId && !c.refineMeshyTaskId) {
      const r = await pollTextModel(c.meshyTaskId);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded") {
        const refineMeshyTaskId = await createRefine(c.meshyTaskId);
        await updateCharacterFields(c.id, { refineMeshyTaskId });
        changed = true;
      }
      continue;
    }

    // 단계 2: refine 폴링 → 완료 시 textured GLB 다운로드 + rig 요청
    if (c.refineMeshyTaskId && !c.modelPath) {
      const r = await pollTextModel(c.refineMeshyTaskId);
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

    // 단계 2: rig 폴링 → idle.glb 다운로드 + sleep animation 요청 (action_id 269)
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
        const sleepTaskId = await createAnimation(c.rigTaskId, 269);
        fields.sleepMeshyTaskId = sleepTaskId;

        await updateCharacterFields(c.id, fields);

        // 리그 완료 → 모든 프리셋 행동 자동 생성 (중복 제외)
        const existingActions = await findActionsByCharacterId(c.id);
        const existingNames = new Set(existingActions.map((a) => a.name));
        await Promise.allSettled(
          ANIMATION_PRESETS
            .filter((preset) => !existingNames.has(preset.label))
            .map(async (preset) => {
              const taskId = await createAnimation(c.rigTaskId!, preset.actionId);
              await saveAction({
                characterId: c.id,
                name: preset.label,
                generationStatus: "pending",
                meshyTaskId: taskId,
              });
            })
        );

        changed = true;
      }
      continue;
    }

    // 단계 3: sleep animation 폴링 → sleep.glb 저장 후 ready
    if (c.sleepMeshyTaskId && !c.sleepAnimPath) {
      const r = await pollAnimation(c.sleepMeshyTaskId);
      if (r.status === "failed") {
        await updateCharacterFields(c.id, { generationStatus: "failed" });
        changed = true;
        continue;
      }
      if (r.status === "succeeded" && r.glbUrl) {
        const sleepPath = await downloadGlb(r.glbUrl, `models/${c.id}`, "sleep.glb");
        await updateCharacterFields(c.id, {
          sleepAnimPath: sleepPath,
          generationStatus: "ready",
        });
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

async function autoCreateMissingActions(): Promise<void> {
  const character = useCharacterStore.getState().character;
  if (!character?.rigTaskId || character.generationStatus !== "ready") return;

  const existing = await findActionsByCharacterId(character.id);
  if (existing.length > 0) return; // 이미 행동이 있으면 스킵

  const results = await Promise.allSettled(
    ANIMATION_PRESETS.map(async (preset) => {
      const taskId = await createAnimation(character.rigTaskId!, preset.actionId);
      const action = await saveAction({
        characterId: character.id,
        name: preset.label,
        generationStatus: "pending",
        meshyTaskId: taskId,
      });
      return action;
    })
  );

  const created = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof saveAction>>> => r.status === "fulfilled")
    .map((r) => r.value);

  if (created.length > 0) {
    useActionStore.getState().setActions(created);
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
