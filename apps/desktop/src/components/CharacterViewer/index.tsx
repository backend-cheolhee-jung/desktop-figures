import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Character } from "@/store/characterStore";
import { Action, WidgetStatus } from "@/store/actionStore";
import { toGlbUrl } from "@/lib/glbUtils";

interface Props {
  character: Character;
  currentAction: Action | null;
  status: WidgetStatus;
}

function Model({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.3).play();
    return () => {
      first?.fadeOut(0.3);
    };
  }, [actions]);

  return <primitive object={scene} scale={1.5} position={[0, -1, 0]} />;
}

export default function CharacterViewer({ character, currentAction, status }: Props) {
  // 표시할 GLB 로컬 경로 결정 (PNG 교체 로직과 1:1 대응)
  const relativePath = useMemo(() => {
    if (status === "idle") return character.sleepAnimPath;
    return currentAction?.animationPath ?? character.idleAnimPath;
  }, [status, currentAction, character]);

  if (character.generationStatus === "pending") {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs animate-pulse">
        3D 캐릭터 생성 중...
      </div>
    );
  }
  if (character.generationStatus === "failed" || !relativePath) {
    return (
      <div className="w-full h-full flex items-center justify-center text-3xl">
        🐾
      </div>
    );
  }

  const url = toGlbUrl(relativePath);

  return (
    <Canvas
      key={url}
      gl={{ alpha: true }}
      camera={{ position: [0, 0, 4], fov: 40 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 2]} intensity={1} />
      <Suspense fallback={null}>
        <Model url={url} />
      </Suspense>
    </Canvas>
  );
}
