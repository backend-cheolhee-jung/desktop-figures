import { Component, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Character } from "@/store/characterStore";
import { Action, WidgetStatus } from "@/store/actionStore";
import { toGlbUrl } from "@/lib/glbUtils";

interface Props {
  character: Character;
  currentAction: Action | null;
  status: WidgetStatus;
}

function Model({ url, sleeping }: { url: string; sleeping: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    if (sleeping) return;
    const first = Object.values(actions)[0];
    first?.reset().fadeIn(0.3).play();
    return () => {
      first?.fadeOut(0.3);
    };
  }, [actions, sleeping]);

  useFrame(({ clock }) => {
    if (!sleeping || !groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.05;
    const breathe = 1 + Math.sin(t * 0.5) * 0.02;
    groupRef.current.scale.setScalar(breathe);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1.5} position={[0, -1, 0]} />
    </group>
  );
}

const Fallback = () => (
  <div className="w-full h-full flex items-center justify-center text-3xl">
    🐾
  </div>
);

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_: Error, __: ErrorInfo) {}

  componentDidUpdate(prevProps: { children: ReactNode }) {
    if (prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function useResolvedGlbUrl(relativePath: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!relativePath) {
      setUrl(null);
      return;
    }
    let blobUrl: string | null = null;
    let cancelled = false;
    toGlbUrl(relativePath).then((resolved) => {
      if (cancelled) {
        URL.revokeObjectURL(resolved);
      } else {
        blobUrl = resolved;
        setUrl(resolved);
      }
    });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [relativePath]);

  return url;
}

export default function CharacterViewer({ character, currentAction, status }: Props) {
  const relativePath = useMemo(() => {
    if (status === "idle") return character.sleepAnimPath;
    return currentAction?.animationPath ?? character.idleAnimPath;
  }, [status, currentAction, character]);

  const url = useResolvedGlbUrl(relativePath);

  if (character.generationStatus === "pending") {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs animate-pulse">
        3D 캐릭터 생성 중...
      </div>
    );
  }
  if (character.generationStatus === "failed" || !relativePath) {
    return <Fallback />;
  }
  if (!url) return null;

  return (
    <ErrorBoundary fallback={<Fallback />}>
      <Canvas
        key={url}
        gl={{ alpha: true }}
        camera={{ position: [0, 0, 4], fov: 40 }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 3, 2]} intensity={1} />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <Model url={url} sleeping={status === "idle"} />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
  );
}
