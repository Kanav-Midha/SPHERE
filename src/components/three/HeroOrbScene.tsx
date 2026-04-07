import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, MeshDistortMaterial, Points, PointMaterial } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function Orb() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y += 0.004;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.18;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.5} floatIntensity={1.1}>
      <mesh ref={ref} scale={1.7}>
        <icosahedronGeometry args={[1.2, 18]} />
        <MeshDistortMaterial
          color="#7dd3fc"
          roughness={0.08}
          metalness={0.35}
          emissive="#1d4ed8"
          emissiveIntensity={0.42}
          distort={0.34}
          speed={1.7}
        />
      </mesh>
    </Float>
  );
}

function HaloPoints() {
  const points = useMemo(() => {
    const count = 600;
    const position = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const radius = 2.4 + Math.random() * 1.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      position[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      position[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      position[i * 3 + 2] = radius * Math.cos(phi);
    }

    return position;
  }, []);

  return (
    <Points positions={points} stride={3}>
      <PointMaterial size={0.035} color="#a5f3fc" transparent opacity={0.65} depthWrite={false} />
    </Points>
  );
}

export default function HeroOrbScene() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-[42px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 42 }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 4]} intensity={2.4} color="#67e8f9" />
        <pointLight position={[-4, -2, 2]} intensity={1.3} color="#a855f7" />
        <pointLight position={[2, 2, -2]} intensity={1.1} color="#34d399" />
        <HaloPoints />
        <Orb />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
