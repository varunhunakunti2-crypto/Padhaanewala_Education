"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Sparkles } from "lucide-react";

const MODEL_URL = "/bot_robot.glb";

/**
 * Module-level cache for the GLTF payload.
 *
 * The bot appears in three places at once (chat header, sliding message avatar,
 * and the site-wide Ask-AI FAB in the root layout). Without this, each instance
 * issued its own 978 KB request and parsed its own copy of the buffer. The
 * browser HTTP cache usually collapses the network request, but the parse cost
 * is per-instance, so the parsed result is shared and each viewer clones the
 * scene graph instead.
 */
type LoadedModel = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  maxDim: number;
  center: THREE.Vector3;
};

let modelPromise: Promise<LoadedModel> | null = null;
let modelFailed = false;

function loadModel(): Promise<LoadedModel> {
  if (modelFailed) return Promise.reject(new Error("model unavailable"));
  if (!modelPromise) {
    modelPromise = new Promise<LoadedModel>((resolve, reject) => {
      new GLTFLoader().load(
        MODEL_URL,
        (gltf) => {
          const box = new THREE.Box3().setFromObject(gltf.scene);
          resolve({
            scene: gltf.scene,
            animations: gltf.animations ?? [],
            maxDim: Math.max(...box.getSize(new THREE.Vector3()).toArray()),
            center: box.getCenter(new THREE.Vector3()),
          });
        },
        undefined,
        (err) => {
          // Allow a later mount to retry rather than caching the failure forever.
          modelPromise = null;
          modelFailed = true;
          reject(err);
        },
      );
    });
  }
  return modelPromise;
}

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
  const instanceOffsetRef = useRef<number>(animationOffset ?? 0);

  /**
   * All animated props are read through this ref inside the render loop.
   * Holding them in a ref means the (expensive) scene/renderer setup runs exactly
   * once per mount instead of tearing down and rebuilding the whole WebGL
   * context whenever a parent re-renders with a new prop value.
   */
  const propsRef = useRef({ autoRotate, interactive, rotationY, animationSpeed, animated, animationMode, modelScale });

  // Synced after commit rather than during render, so the ref is never read or
  // written as part of rendering.
  useEffect(() => {
    propsRef.current = {
      autoRotate,
      interactive,
      rotationY,
      animationSpeed,
      animated,
      animationMode,
      modelScale,
    };
  });

  useEffect(() => {
    if (animationOffset === undefined) {
      instanceOffsetRef.current = Math.random() * 10;
    }
  }, [animationOffset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let disposed = false;

    try {
      const width = container.clientWidth || 44;
      const height = container.clientHeight || 44;

      // 1. Scene
      const scene = new THREE.Scene();

      // 2. Fixed camera with medium-wide field of view - 0 cropping from head to feet
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.4);

      // 3. WebGL Renderer with antialias and alpha transparency
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
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
      const applyThemeColor = (model: THREE.Object3D) => {
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

      // 5. Load GLTF model (shared across every RobotViewer instance on the page)
      const timer = new THREE.Timer();
      let robotModel: THREE.Object3D | null = null;
      let initialY = 0;

      loadModel()
        .then((loadedModel) => {
          if (disposed) return;

          // cloneSkeleton keeps the bone hierarchy intact so animations bind.
          const model = cloneSkeleton(loadedModel.scene);
          robotModel = model;

          // Scale so the full character fits the camera frustum with a safety margin.
          const scale = (1.05 * propsRef.current.modelScale) / loadedModel.maxDim;
          model.scale.setScalar(scale);

          // Center model geometry perfectly around the origin.
          model.position.x = -loadedModel.center.x * scale;
          model.position.y = -loadedModel.center.y * scale;
          model.position.z = -loadedModel.center.z * scale;

          model.rotation.set(0, propsRef.current.rotationY, 0);
          initialY = model.position.y;

          applyThemeColor(model);

          // Play every clip, de-synchronised per instance so the three bots
          // visible at once never bob in lockstep.
          if (propsRef.current.animated && loadedModel.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            const offset = instanceOffsetRef.current;
            loadedModel.animations.forEach((clip) => {
              const action = mixer?.clipAction(clip);
              if (action) {
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.clampWhenFinished = false;
                action.enabled = true;
                action.play();
                if (clip.duration > 0) action.time = offset % clip.duration;
              }
            });
          }

          scene.add(model);
          setLoaded(true);
        })
        .catch((err) => {
          if (disposed) return;
          console.error("Failed to load 3D bot model:", err);
          setError(true);
        });

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

      // 6. Animation render loop with smooth idle motion and desynchronized phase timing.
      //    The loop parks itself whenever the canvas is off-screen or the tab is
      //    hidden, so a scrolled-past bot costs nothing.
      let visible = true;
      const loop = () => {
        animationFrameId = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;

        timer.update();
        const delta = timer.getDelta();
        const elapsedTime = timer.getElapsed() + instanceOffsetRef.current;

        const p = propsRef.current;
        if (p.animated && mixer) mixer.update(delta * p.animationSpeed);

        if (robotModel) {
          if (p.autoRotate || p.animationMode === "spin") {
            robotModel.rotation.y += 0.008;
          } else if (p.animationMode === "sway" || p.animationMode === "wave") {
            robotModel.rotation.y = p.rotationY + Math.sin(elapsedTime * 2.2) * 0.25;
            robotModel.rotation.z = Math.sin(elapsedTime * 1.8) * 0.08;
          } else if (p.animationMode === "middle") {
            robotModel.rotation.y = p.rotationY + Math.sin(elapsedTime * 1.4) * 0.1;
            robotModel.rotation.z = Math.sin(elapsedTime * 1.2) * 0.03;
          } else {
            robotModel.rotation.y = p.rotationY;
            robotModel.rotation.z = 0;
          }

          if (p.animated) {
            if (p.animationMode === "bounce") {
              robotModel.position.y = initialY + Math.abs(Math.sin(elapsedTime * 3.2)) * 0.025;
            } else if (p.animationMode === "sway" || p.animationMode === "wave") {
              robotModel.position.y = initialY + Math.sin(elapsedTime * 2.0) * 0.015;
            } else if (p.animationMode === "middle") {
              robotModel.position.y = initialY + Math.sin(elapsedTime * 1.6) * 0.012;
            } else {
              // Gentle, seamless mechanical idle bobbing (desynchronized)
              robotModel.position.y = initialY + Math.sin(elapsedTime * 1.5) * 0.015;
            }
          }

          if (p.interactive) {
            robotModel.rotation.x = THREE.MathUtils.lerp(
              robotModel.rotation.x,
              mouseY * 0.15,
              0.06
            );
            robotModel.rotation.y = THREE.MathUtils.lerp(
              robotModel.rotation.y,
              p.rotationY + mouseX * 0.2,
              0.06
            );
          }
        }

        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      };

      loop();

      // Park rendering when this canvas scrolls out of view.
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { threshold: 0 },
      );
      visibilityObserver.observe(container);

      // Handle canvas resize
      const handleResize = () => {
        if (!container || !renderer) return;
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if (!newW || !newH) return;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      return () => {
        disposed = true;
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();
        visibilityObserver.disconnect();
        themeObserver.disconnect();
        timer.dispose();
        if (interactive) {
          window.removeEventListener("mousemove", handleMouseMove);
        }
        // Release GPU resources owned by this instance's clone of the model.
        robotModel?.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of materials) mat?.dispose();
        });
        mixer?.stopAllAction();
        mixer = null;
        if (renderer && renderer.domElement) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
          renderer.forceContextLoss();
        }
      };
    } catch (e) {
      console.error("3D WebGL initialization error:", e);
      queueMicrotask(() => setError(true));
    }
    // Intentionally empty: every animated prop is read via propsRef, so the
    // WebGL context is created once per mount and never rebuilt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
