"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

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
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const [elasticTransform, setElasticTransform] = useState({ x: 0, y: 0, scaleX: 1, scaleY: 1 });

  // Track mouse for border shine + elasticity
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!glassRef.current) return;
      const rect = glassRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const offX = ((e.clientX - cx) / rect.width) * 100;
      const offY = ((e.clientY - cy) / rect.height) * 100;
      setMouseOffset({ x: offX, y: offY });

      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });

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
          setElasticTransform({
            x: tx,
            y: ty,
            scaleX: Math.max(0.85, sx),
            scaleY: Math.max(0.85, sy),
          });
        } else {
          setElasticTransform({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
        }
      }
    },
    [elasticity]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMouseOffset({ x: 0, y: 0 });
    if (elasticity > 0) {
      setElasticTransform({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
    }
  }, [elasticity]);

  // Border shine gradient — rotates with mouse
  const gradAngle = 135 + mouseOffset.x * 1.2;
  const gradStop1 = Math.max(10, 33 + mouseOffset.y * 0.3);
  const gradStop2 = Math.min(90, 66 + mouseOffset.y * 0.4);
  const screenAlpha1 = 0.12 + Math.abs(mouseOffset.x) * 0.008;
  const screenAlpha2 = 0.4 + Math.abs(mouseOffset.x) * 0.012;
  const overlayAlpha1 = 0.32 + Math.abs(mouseOffset.x) * 0.008;
  const overlayAlpha2 = 0.6 + Math.abs(mouseOffset.x) * 0.012;

  // Shadow
  const shadowAlpha = 0.25 * shadowIntensity;
  const shadowBlur = 40 * shadowIntensity;
  const shadowY = 12 * shadowIntensity;
  const shadow = shadowIntensity > 0
    ? `0px ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowAlpha})`
    : "none";

  // Elasticity transform
  const elasticStyle =
    elasticity > 0
      ? {
          transform: `translate(${elasticTransform.x}px, ${elasticTransform.y}px) scaleX(${elasticTransform.scaleX}) scaleY(${elasticTransform.scaleY})`,
          transition: "transform 0.2s ease-out",
        }
      : {};

  return (
    <div
      ref={glassRef}
      className={`relative overflow-visible select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        borderRadius: cornerRadius,
        boxShadow: shadow,
        backdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
        WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
        ...elasticStyle,
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
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
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
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          mixBlendMode: "screen",
          opacity: 0.2 * borderOpacity,
          padding: "1.5px",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow: "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset, 0 1px 4px rgba(0,0,0,0.35)",
          background: `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${screenAlpha1}) ${gradStop1}%, rgba(255,255,255,${screenAlpha2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`,
        }}
      />

      {/* Layer 5: Border shine (overlay) */}
      <span
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          mixBlendMode: "overlay",
          opacity: borderOpacity,
          padding: "1.5px",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          boxShadow: "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset, 0 1px 4px rgba(0,0,0,0.35)",
          background: `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${overlayAlpha1}) ${gradStop1}%, rgba(255,255,255,${overlayAlpha2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`,
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
