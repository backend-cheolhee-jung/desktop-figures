import { Component, Suspense, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment } from "@react-three/drei";
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
        <ambientLight intensity={1.2} />
        <directionalLight position={[2, 4, 3]} intensity={2} />
        <directionalLight position={[-2, 2, -1]} intensity={0.8} />
        <Environment preset="sunset" />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
      </Canvas>
    </ErrorBoundary>
  );
}
