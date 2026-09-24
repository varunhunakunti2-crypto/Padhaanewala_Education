"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Sparkles } from "lucide-react";

interface RobotViewerProps {
  className?: string;
  autoRotate?: boolean;
  interactive?: boolean;
  rotationY?: number;
  modelScale?: number;
  animationSpeed?: number;
  animationOffset?: number;
  animated?: boolean;
  animationMode?: "idle" | "sway" | "bounce" | "wave" | "spin" | "middle";
}

export function RobotViewer({
  className = "h-10 w-10",
  autoRotate = false,
  interactive = false,
  rotationY = 0,
  modelScale = 1.25,
  animationSpeed = 1.0,
  animationOffset,
  animated = true,
  animationMode = "idle",
}: RobotViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  // Unique random animation phase offset per instance if animationOffset isn't specified
  const needsRandomOffsetRef = useRef(animationOffset === undefined);
  const instanceOffsetRef = useRef<number>(animationOffset ?? 0);

  useEffect(() => {
    if (needsRandomOffsetRef.current) {
      instanceOffsetRef.current = Math.random() * 10;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let mixer: THREE.AnimationMixer | null = null;

    try {
      const width = container.clientWidth || 44;
      const height = container.clientHeight || 44;

      // 1. Scene
      const scene = new THREE.Scene();

      // 2. Fixed camera with medium-wide field of view - 0 cropping from head to feet
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.4);

      // 3. WebGL Renderer with antialias and alpha transparency
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      // 4. High-Luminance Studio Lighting setup — ultra-crisp 3D character illumination
      const ambientLight = new THREE.AmbientLight(0xffffff, 3.6);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 4.5);
      keyLight.position.set(2, 4, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xc084fc, 2.8);
      fillLight.position.set(-3.5, 2, 3);
      scene.add(fillLight);

      const backLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
      backLight.position.set(0, 4, -4);
      scene.add(backLight);

      // Helper to apply stealth black metallic palette in White mode matching reference image
      const applyThemeColor = (model: THREE.Group) => {
        const isDark = document.documentElement.classList.contains("dark");
        const hsl = { h: 0, s: 0, l: 0 };

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((mat) => {
                if (mat && "color" in mat && (mat as THREE.MeshStandardMaterial).color) {
                  const m = mat as THREE.MeshStandardMaterial;
                  if (!m.userData.origColor) {
                    m.userData.origColor = m.color.clone();
                  }

                  if (!isDark) {
                    // White mode: stealth dark metallic black (as shown in image media_1789937995166)
                    const nameLower = mesh.name.toLowerCase();
                    m.userData.origColor.getHSL(hsl);

                    if (nameLower.includes("eye") || nameLower.includes("visor") || nameLower.includes("light")) {
                      // Visor eyes -> Electric Cyan #00F0FF
                      m.color.setHex(0x00f0ff);
                    } else if (hsl.l > 0.5) {
                      // Head, helmet, hands, limbs -> Stealth Dark Metallic Black #18181B
                      m.color.setHex(0x18181b);
                    } else if (hsl.l > 0.15 || nameLower.includes("chest") || nameLower.includes("torso")) {
                      // Chest torso armor -> Dark Charcoal #27272A
                      m.color.setHex(0x27272a);
                    } else {
                      // Joints & inner frame -> Deep Midnight Black #090D16
                      m.color.setHex(0x090d16);
                    }
                    m.roughness = 0.35;
                    m.metalness = 0.25;
                  } else {
                    // Dark mode: restore original ceramic white & graphite model colors
                    m.color.copy(m.userData.origColor);
                    if (mesh.name.toLowerCase().includes("eye") || mesh.name.toLowerCase().includes("visor")) {
                      m.color.setHex(0x38bdf8);
                    }
                    m.roughness = 0.35;
                    m.metalness = 0.1;
                  }
                }
              });
            }
          }
        });
      };

      // 5. Load GLTF model
      const loader = new GLTFLoader();
      const clock = new THREE.Clock();
      let robotModel: THREE.Group | null = null;
      let initialY = 0;

      loader.load(
        "/bot_robot.glb",
        (gltf) => {
          robotModel = gltf.scene;

          // Compute exact bounding box of the 3D model
          const box = new THREE.Box3().setFromObject(robotModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          // Scale factor calibrated so full character from head to feet fits within camera frustum with safety margin
          const scale = (1.05 * modelScale) / maxDim;

          robotModel.scale.setScalar(scale);

          // Center model geometry perfectly around origin (0, 0, 0)
          robotModel.position.x = -center.x * scale;
          robotModel.position.y = -center.y * scale;
          robotModel.position.z = -center.z * scale;

          // Initial rotation facing front
          robotModel.rotation.set(0, rotationY, 0);
          initialY = robotModel.position.y;

          // Apply initial theme color (black in white mode, original in dark mode)
          applyThemeColor(robotModel);

          // Enable & play all skeletal animation tracks smoothly with phase desynchronization
          if (animated && gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(robotModel);
            const offset = instanceOffsetRef.current;
            gltf.animations.forEach((clip) => {
              const action = mixer?.clipAction(clip);
              if (action) {
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.clampWhenFinished = false;
                action.enabled = true;
                action.play();
                if (clip.duration > 0) {
                  action.time = offset % clip.duration;
                }
              }
            });
          }

          scene.add(robotModel);
          setLoaded(true);
        },
        undefined,
        (err) => {
          console.error("Failed to load 3D bot model:", err);
          setError(true);
        }
      );

      // Listen to theme mode changes (dark <-> light toggle)
      const themeObserver = new MutationObserver(() => {
        if (robotModel) {
          applyThemeColor(robotModel);
        }
      });

      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      // Mouse interaction handlers
      let mouseX = 0;
      let mouseY = 0;
      const handleMouseMove = (e: MouseEvent) => {
        if (!interactive) return;
        const rect = container.getBoundingClientRect();
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      };

      if (interactive) {
        window.addEventListener("mousemove", handleMouseMove);
      }

      // 6. Animation render loop with smooth idle motion and desynchronized phase timing
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime() + instanceOffsetRef.current;

        if (animated && mixer) mixer.update(delta * animationSpeed);

        if (robotModel) {
          if (autoRotate || animationMode === "spin") {
            robotModel.rotation.y += 0.008;
          } else if (animationMode === "sway" || animationMode === "wave") {
            robotModel.rotation.y = rotationY + Math.sin(elapsedTime * 2.2) * 0.25;
            robotModel.rotation.z = Math.sin(elapsedTime * 1.8) * 0.08;
          } else if (animationMode === "middle") {
            robotModel.rotation.y = rotationY + Math.sin(elapsedTime * 1.4) * 0.1;
            robotModel.rotation.z = Math.sin(elapsedTime * 1.2) * 0.03;
          } else {
            robotModel.rotation.y = rotationY;
            robotModel.rotation.z = 0;
          }

          if (animated) {
            if (animationMode === "bounce") {
              robotModel.position.y = initialY + Math.abs(Math.sin(elapsedTime * 3.2)) * 0.025;
            } else if (animationMode === "sway" || animationMode === "wave") {
              robotModel.position.y = initialY + Math.sin(elapsedTime * 2.0) * 0.015;
            } else if (animationMode === "middle") {
              robotModel.position.y = initialY + Math.sin(elapsedTime * 1.6) * 0.012;
            } else {
              // Gentle, seamless mechanical idle bobbing (desynchronized)
              robotModel.position.y = initialY + Math.sin(elapsedTime * 1.5) * 0.015;
            }
          }

          if (interactive) {
            robotModel.rotation.x = THREE.MathUtils.lerp(
              robotModel.rotation.x,
              mouseY * 0.15,
              0.06
            );
            robotModel.rotation.y = THREE.MathUtils.lerp(
              robotModel.rotation.y,
              rotationY + mouseX * 0.2,
              0.06
            );
          }
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };

      animate();

      // Handle canvas resize
      const handleResize = () => {
        if (!container || !renderer) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => {
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        themeObserver.disconnect();
        if (interactive) {
          window.removeEventListener("mousemove", handleMouseMove);
        }
        if (renderer && renderer.domElement) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (e) {
      console.error("3D WebGL initialization error:", e);
      queueMicrotask(() => setError(true));
    }
  }, [autoRotate, interactive]);

  if (error) {
    return (
      <span className={`grid place-items-center rounded-full bg-purple-500/20 text-white ${className}`}>
        <Sparkles className="h-5 w-5" />
      </span>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {!loaded && (
        <span className="absolute inset-0 grid place-items-center rounded-full bg-purple-500/20 text-white animate-pulse">
          <Sparkles className="h-4 w-4" />
        </span>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
