import { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/model/scene.gltf";

function Multimeter({
  mouseRef,
}: {
  mouseRef: React.MutableRefObject<[number, number]>;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null!);
  const clonedScene = useRef(scene.clone()).current;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const [mx, my] = mouseRef.current;

    groupRef.current.position.y = Math.sin(t * 0.55) * 0.12;

    // -π/2 on X corrects Z-up export → stands model upright
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      -Math.PI / 2 + my * 0.18,
      0.04
    );

    // Slight 3/4 view + slow auto-spin + mouse X tilt
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      0.25 + mx * 0.4 + t * 0.07,
      0.04
    );
  });

  return (
    <group ref={groupRef} scale={0.26} rotation={[-Math.PI / 2, 0.25, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload(MODEL_PATH);

export function ModelViewer() {
  const mouseRef = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseRef.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      ];
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    // CSS filter: boost saturation so the orange pops, slight contrast lift
    <div
      className="h-full w-full"
      style={{ filter: "saturate(1.45) contrast(1.08) brightness(1.12)" }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.55,
        }}
        style={{ background: "transparent" }}
      >
        {/* IBL — studio preset gives soft, even product-shot lighting */}
        <Environment preset="studio" background={false} />

        {/* Ambient fill so shadow areas aren't dead black */}
        <ambientLight intensity={0.4} />

        {/* Key light — slightly warm, front-top */}
        <directionalLight
          position={[2, 6, 8]}
          intensity={2.2}
          color="#fff6ee"
        />

        {/* Secondary fill from the right */}
        <directionalLight
          position={[-5, 2, 3]}
          intensity={0.7}
          color="#ddeeff"
        />

        {/* Blue rim — accent from behind-left */}
        <pointLight position={[-6, 3, -5]} intensity={1.4} color="#93c5fd" />

        {/* Pink under-fill */}
        <pointLight position={[3, -6, 4]} intensity={0.6} color="#f0abdc" />

        <Suspense fallback={null}>
          <Multimeter mouseRef={mouseRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
