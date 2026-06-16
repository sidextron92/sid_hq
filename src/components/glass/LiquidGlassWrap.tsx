"use client";

import React, { useRef, useCallback } from "react";

interface LiquidGlassWrapProps {
  children: React.ReactNode;
  /** Border radius in px */
  cornerRadius?: number;
  /** CSS padding for the content area */
  padding?: string;
  className?: string;
  style?: React.CSSProperties;
  /** @deprecated SVG displacement filter has been removed. Prop accepted but ignored. */
  displacementScale?: number;
  /** Frosting / blur amount in px (0 = clear glass, 40 = fully frosted) */
  blurAmount?: number;
  /** Backdrop color saturation % (100 = normal, 200 = vivid) */
  saturation?: number;
  /** Elasticity — how much the glass follows the cursor (0 = static, 1 = max follow) */
  elasticity?: number;
  /** Dark tint mode for use on bright backgrounds */
  overLight?: boolean;
  /** Drop shadow depth (0 = none, 1 = default, 2 = heavy) */
  shadowIntensity?: number;
  /** Border shine visibility (0 = hidden, 1 = default) */
  borderOpacity?: number;
  /** Tint color — adds a colored overlay to the glass surface */
  tint?: string;
  /** Click handler */
  onClick?: () => void;
}

export default function LiquidGlassWrap({
  children,
  cornerRadius = 32,
  padding = "24px 28px",
  className = "",
  style,
  blurAmount = 5,
  saturation = 140,
  elasticity = 0.3,
  overLight = false,
  shadowIntensity = 1,
  borderOpacity = 1,
  tint,
  onClick,
}: LiquidGlassWrapProps) {
  const glassRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const borderScreenRef = useRef<HTMLSpanElement>(null);
  const borderOverlayRef = useRef<HTMLSpanElement>(null);

  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{
    offX: number;
    offY: number;
    mouseX: number;
    mouseY: number;
    transform: string;
  } | null>(null);

  const applyGlassStyles = useCallback((offX: number, offY: number, mouseX: number, mouseY: number, transform: string) => {
    const glow = glowRef.current;
    if (glow) {
      glow.style.background = `radial-gradient(circle at ${mouseX * 100}% ${mouseY * 100}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`;
    }

    const gradAngle = 135 + offX * 1.2;
    const gradStop1 = Math.max(10, 33 + offY * 0.3);
    const gradStop2 = Math.min(90, 66 + offY * 0.4);
    const screenAlpha1 = 0.12 + Math.abs(offX) * 0.008;
    const screenAlpha2 = 0.4 + Math.abs(offX) * 0.012;
    const overlayAlpha1 = 0.32 + Math.abs(offX) * 0.008;
    const overlayAlpha2 = 0.6 + Math.abs(offX) * 0.012;

    const screen = borderScreenRef.current;
    if (screen) {
      screen.style.background = `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${screenAlpha1}) ${gradStop1}%, rgba(255,255,255,${screenAlpha2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`;
    }

    const overlay = borderOverlayRef.current;
    if (overlay) {
      overlay.style.background = `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${overlayAlpha1}) ${gradStop1}%, rgba(255,255,255,${overlayAlpha2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`;
    }

    if (glassRef.current && elasticity > 0) {
      glassRef.current.style.transform = transform;
    }
  }, [elasticity]);

  const flushMouseUpdates = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    applyGlassStyles(p.offX, p.offY, p.mouseX, p.mouseY, p.transform);
  }, [applyGlassStyles]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!glassRef.current) return;
      const rect = glassRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const offX = ((e.clientX - cx) / rect.width) * 100;
      const offY = ((e.clientY - cy) / rect.height) * 100;

      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      let transform = "translate(0px, 0px) scaleX(1) scaleY(1)";
      if (elasticity > 0) {
        const deltaX = e.clientX - cx;
        const deltaY = e.clientY - cy;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const edgeDistX = Math.max(0, Math.abs(deltaX) - rect.width / 2);
        const edgeDistY = Math.max(0, Math.abs(deltaY) - rect.height / 2);
        const edgeDist = Math.sqrt(edgeDistX * edgeDistX + edgeDistY * edgeDistY);
        const zone = 200;

        if (edgeDist < zone) {
          const fade = 1 - edgeDist / zone;
          const tx = deltaX * elasticity * 0.1 * fade;
          const ty = deltaY * elasticity * 0.1 * fade;
          const normX = dist > 0 ? Math.abs(deltaX / dist) : 0;
          const normY = dist > 0 ? Math.abs(deltaY / dist) : 0;
          const stretch = Math.min(dist / 300, 1) * elasticity * fade;
          const sx = 1 + normX * stretch * 0.3 - normY * stretch * 0.15;
          const sy = 1 + normY * stretch * 0.3 - normX * stretch * 0.15;
          transform = `translate(${tx}px, ${ty}px) scaleX(${Math.max(0.85, sx)}) scaleY(${Math.max(0.85, sy)})`;
        }
      }

      pendingRef.current = {
        offX,
        offY,
        mouseX,
        mouseY,
        transform,
      };

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushMouseUpdates);
      }
    },
    [elasticity, flushMouseUpdates]
  );

  const handleMouseEnter = useCallback(() => {
    if (glowRef.current) glowRef.current.style.opacity = "1";
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
    if (glowRef.current) glowRef.current.style.opacity = "0";
    applyGlassStyles(0, 0, 0.5, 0.5, "translate(0px, 0px) scaleX(1) scaleY(1)");
  }, [applyGlassStyles]);

  // Shadow
  const shadowAlpha = 0.25 * shadowIntensity;
  const shadowBlur = 40 * shadowIntensity;
  const shadowY = 12 * shadowIntensity;
  const shadow = shadowIntensity > 0
    ? `0px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha})`
    : "none";

  return (
    <div
      ref={glassRef}
      className={`relative overflow-visible select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        borderRadius: cornerRadius,
        boxShadow: shadow,
        backdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
        WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
        ...(elasticity > 0
          ? { transform: "translate(0px, 0px) scaleX(1) scaleY(1)", transition: "transform 0.2s ease-out" }
          : {}),
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Layer 1: Dark tint for overLight mode */}
      {overLight && (
        <span
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ background: "black", opacity: 0.15, mixBlendMode: "overlay" }}
        />
      )}

      {/* Layer 2: Hover highlight — radial glow that follows cursor */}
      <span
        ref={glowRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)",
          opacity: 0,
          transition: "opacity 0.2s ease-out",
          mixBlendMode: "overlay",
        }}
      />

      {/* Layer 3: Color tint overlay (two passes for visibility on any background) */}
      {tint && (
        <>
          <span
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{ background: tint, opacity: 0.55 }}
          />
          <span
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{ background: tint, mixBlendMode: "overlay", opacity: 0.6 }}
          />
        </>
      )}

      {/* Layer 4: Border shine (screen) */}
      <span
        ref={borderScreenRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          mixBlendMode: "screen",
          opacity: 0.2 * borderOpacity,
          padding: "1.5px",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow: "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset, 0 1px 4px rgba(0,0,0,0.35)",
          background: "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 33%, rgba(255,255,255,0.4) 66%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Layer 5: Border shine (overlay) */}
      <span
        ref={borderOverlayRef}
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          mixBlendMode: "overlay",
          opacity: borderOpacity,
          padding: "1.5px",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow: "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset, 0 1px 4px rgba(0,0,0,0.35)",
          background: "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.32) 33%, rgba(255,255,255,0.6) 66%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* Content */}
      <div
        className="relative z-10"
        style={{
          padding,
          color: "white",
          textShadow: overLight ? "none" : "0px 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
