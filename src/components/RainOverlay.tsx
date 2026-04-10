"use client";

import { useRef, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────
interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  thickness: number;
  /** Set of card rect indices this drop has already passed through */
  passThrough: Set<number>;
}

interface Splatter {
  x: number;
  y: number;
  particles: SplatterParticle[];
  age: number;
  maxAge: number;
}

interface SplatterParticle {
  angle: number;
  speed: number;
  distance: number;
  size: number;
  opacity: number;
  decay: number;
}

export interface RainConfig {
  /** 1 = light drizzle, 2 = moderate, 3 = heavy downpour */
  intensity: number;
  /** -1 (left) to 1 (right), 0 = straight down */
  wind: number;
  /** 0 to 1, controls drop visibility */
  opacity: number;
  /** splatter particle base size multiplier */
  splatterSize: number;
  /** number of particles per splatter */
  splatterParticleCount: number;
  /** 1 = slow, 2 = medium, 3 = fast — maps to predefined speed ranges */
  speed: number;
  /** @deprecated - derived from speed */
  speedMin: number;
  /** @deprecated - derived from speed */
  speedMax: number;
}

interface RainOverlayProps {
  active: boolean;
  config: RainConfig;
  /** Refs to card DOM elements for collision detection */
  cardRefs: React.RefObject<Record<string, HTMLDivElement | null>>;
}

// ─── Speed presets ──────────────────────────────────
const SPEED_PRESETS: Record<number, { min: number; max: number }> = {
  1: { min: 6, max: 10 },   // Slow
  2: { min: 12, max: 20 },  // Medium
  3: { min: 18, max: 28 },  // Fast
};

// ─── Intensity config ───────────────────────────────
function getConfig(cfg: RainConfig) {
  const t = Math.max(1, Math.min(3, cfg.intensity));
  const s = Math.max(1, Math.min(3, cfg.speed));
  const speedPreset = SPEED_PRESETS[s] ?? SPEED_PRESETS[2];
  const windAngle = cfg.wind * 0.2;
  return {
    dropCount: Math.round(40 + (t - 1) * 80),
    speedMin: speedPreset.min,
    speedMax: speedPreset.max,
    lengthMin: 15 + (t - 1) * 5,
    lengthMax: 30 + (t - 1) * 10,
    windAngle,
    splatterParticleCount: cfg.splatterParticleCount,
    splatterSize: cfg.splatterSize,
    splatterChance: 0.6 + (t - 1) * 0.15,
    opacityScale: Math.max(0, Math.min(1, cfg.opacity)),
  };
}

// ─── Component ──────────────────────────────────────
export default function RainOverlay({ active, config, cardRefs }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<RainDrop[]>([]);
  const splattersRef = useRef<Splatter[]>([]);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(active);
  const configRef = useRef(config);

  activeRef.current = active;
  configRef.current = config;

  // Get all card bounding rects (cached per frame)
  const getCardRects = useCallback(() => {
    const rects: DOMRect[] = [];
    const refs = cardRefs.current;
    if (!refs) return rects;
    for (const key in refs) {
      const el = refs[key];
      if (el) rects.push(el.getBoundingClientRect());
    }
    return rects;
  }, [cardRefs]);

  // Create a raindrop
  const createDrop = useCallback((w: number, h: number, startFromTop = false): RainDrop => {
    const c = getConfig(configRef.current);
    return {
      x: Math.random() * (w + 100) - 50,
      y: startFromTop ? -Math.random() * h * 0.5 : -Math.random() * h,
      length: c.lengthMin + Math.random() * (c.lengthMax - c.lengthMin),
      speed: c.speedMin + Math.random() * (c.speedMax - c.speedMin),
      opacity: (0.15 + Math.random() * 0.35) * c.opacityScale,
      thickness: 1 + Math.random() * 1.2,
      passThrough: new Set(),
    };
  }, []);

  // Create a splatter at a position
  const createSplatter = useCallback((x: number, y: number): Splatter => {
    const c = getConfig(configRef.current);
    const count = c.splatterParticleCount;
    const particles: SplatterParticle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.15 + Math.random() * -Math.PI * 0.7;
      particles.push({
        angle,
        speed: 1.5 + Math.random() * 3,
        distance: 0,
        size: (1 + Math.random() * 2.5) * c.splatterSize,
        opacity: (0.5 + Math.random() * 0.4) * c.opacityScale,
        decay: 0.92 + Math.random() * 0.05,
      });
    }

    return { x, y, particles, age: 0, maxAge: 25 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const c = getConfig(configRef.current);
    dropsRef.current = Array.from({ length: c.dropCount }, () => createDrop(w, h, false));

    const tick = () => {
      if (!activeRef.current) {
        if (dropsRef.current.length === 0 && splattersRef.current.length === 0) {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
          return;
        }
      }

      const currentW = window.innerWidth;
      const currentH = window.innerHeight;
      const currentCfg = getConfig(configRef.current);

      ctx.clearRect(0, 0, currentW, currentH);

      const cardRects = getCardRects();

      // ─── Update & draw rain drops ────────────────
      const newDrops: RainDrop[] = [];
      const drops = dropsRef.current;

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        drop.y += drop.speed;
        drop.x += drop.speed * currentCfg.windAngle;

        let hitCard = false;
        for (let ri = 0; ri < cardRects.length; ri++) {
          const rect = cardRects[ri];
          if (
            drop.x >= rect.left &&
            drop.x <= rect.right &&
            drop.y >= rect.top &&
            drop.y <= rect.bottom &&
            drop.y - drop.speed < rect.top + 10
          ) {
            if (drop.passThrough.has(ri)) continue;

            if (Math.random() < 0.55) {
              drop.passThrough.add(ri);
              continue;
            }

            hitCard = true;
            if (Math.random() < currentCfg.splatterChance) {
              splattersRef.current.push(createSplatter(drop.x, rect.top));
            }
            break;
          }
        }

        if (hitCard || drop.y > currentH + 20) {
          if (activeRef.current) {
            newDrops.push(createDrop(currentW, currentH, true));
          }
        } else {
          newDrops.push(drop);

          const endX = drop.x + drop.length * currentCfg.windAngle * 0.5;
          const endY = drop.y + drop.length;
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = `rgba(174, 194, 224, ${drop.opacity})`;
          ctx.lineWidth = drop.thickness;
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }

      dropsRef.current = newDrops;

      if (activeRef.current && newDrops.length < currentCfg.dropCount) {
        const needed = currentCfg.dropCount - newDrops.length;
        for (let i = 0; i < Math.min(needed, 3); i++) {
          newDrops.push(createDrop(currentW, currentH, true));
        }
      }

      // ─── Update & draw splatters ─────────────────
      const liveSplatters: Splatter[] = [];

      for (const splatter of splattersRef.current) {
        splatter.age++;
        if (splatter.age > splatter.maxAge) continue;

        let anyVisible = false;

        for (const p of splatter.particles) {
          p.distance += p.speed;
          p.speed *= 0.92;
          p.opacity *= p.decay;

          if (p.opacity < 0.02) continue;
          anyVisible = true;

          const px = splatter.x + Math.cos(p.angle) * p.distance;
          const py = splatter.y + Math.sin(p.angle) * p.distance;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.angle);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 1.5, p.size * 0.8, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(174, 194, 224, ${p.opacity})`;
          ctx.fill();
          ctx.restore();
        }

        const progress = splatter.age / splatter.maxAge;
        const ringRadius = 3 + progress * 12;
        const ringOpacity = Math.max(0, 0.4 * (1 - progress));
        if (ringOpacity > 0.02) {
          ctx.beginPath();
          ctx.arc(splatter.x, splatter.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(174, 194, 224, ${ringOpacity})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          anyVisible = true;
        }

        if (anyVisible) liveSplatters.push(splatter);
      }

      splattersRef.current = liveSplatters;

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active, createDrop, createSplatter, getCardRects]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        opacity: active ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
    />
  );
}
