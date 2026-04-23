// src/components/ImmersiveCloudBackground.jsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Float, Cloud } from "@react-three/drei";

export default function ImmersiveCloudBackground() {
  return (
    <Canvas
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        background: "linear-gradient(to bottom, #e0f7fa, #ffffff)"
      }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <Stars radius={100} depth={50} count={5000} factor={4} fade />
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <Cloud opacity={0.3} speed={0.4} width={10} depth={1.5} segments={20} color="#81c784"/>
      </Float>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
}
