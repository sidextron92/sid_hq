"use client";

import React, { useRef, useState, useEffect, useCallback, useId } from "react";
import { DISPLACEMENT_MAP } from "./displacement-map";

interface LiquidGlassWrapProps {
  children: React.ReactNode;
  /** Border radius in px */
  cornerRadius?: number;
  /** CSS padding for the content area */
  padding?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Refraction intensity — how much the background bends at glass edges (0–200) */
  displacementScale?: number;
  /** Frosting / blur amount in px (0 = clear glass, 40 = fully frosted) */
  blurAmount?: number;
  /** Backdrop color saturation % (100 = normal, 200 = vivid) */
  saturation?: number;
  /** Chromatic aberration — RGB separation at edges (0 = none, 10 = heavy rainbow) */
  aberrationIntensity?: number;
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
  displacementScale = 100,
  blurAmount = 5,
  saturation = 140,
  aberrationIntensity = 2,
  elasticity = 0.3,
  overLight = false,
  shadowIntensity = 1,
  borderOpacity = 1,
  tint,
  onClick,
}: LiquidGlassWrapProps) {
  const id = useId().replace(/:/g, "");
  const filterId = `glass-${id}`;
  const glassRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 200 });
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 }); // 0-1 relative to element
  const [isHovered, setIsHovered] = useState(false);
  const [elasticTransform, setElasticTransform] = useState({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Measure the glass element
  useEffect(() => {
    if (!glassRef.current) return;
    const measure = () => {
      if (!glassRef.current) return;
      const { width, height } = glassRef.current.getBoundingClientRect();
      setSize((prev) => {
        if (prev.w === Math.round(width) && prev.h === Math.round(height)) return prev;
        return { w: Math.round(width), h: Math.round(height) };
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(glassRef.current);
    return () => ro.disconnect();
  }, []);

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

      // Track cursor position relative to element (0-1) for hover glow
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });

      // Elasticity: translate + directional stretch toward cursor
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

  const scale = displacementScale;
  const aberr = aberrationIntensity;
  const greenScale = scale + aberr * 5;
  const blueScale = scale + aberr * 10;

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
        ...elasticStyle,
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* SVG Filter — skip on touch devices to avoid mobile rendering glitches */}
      {!isTouchDevice && (
        <svg
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          aria-hidden="true"
        >
          <defs>
            <filter
              id={filterId}
              x="-35%"
              y="-35%"
              width="170%"
              height="170%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                x="0" y="0" width="100%" height="100%"
                result="DISPLACEMENT_MAP"
                href={DISPLACEMENT_MAP}
                preserveAspectRatio="xMidYMid slice"
              />
              <feColorMatrix
                in="DISPLACEMENT_MAP" type="matrix"
                values="0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0.3 0.3 0.3 0 0  0 0 0 1 0"
                result="EDGE_INTENSITY"
              />
              <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
                <feFuncA type="discrete" tableValues={`0 ${aberr * 0.05} 1`} />
              </feComponentTransfer>
              <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />

              {/* Chromatic aberration: R, G, B at different displacement scales */}
              <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={-scale} xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED" />
              <feColorMatrix in="RED_DISPLACED" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="RED_CHANNEL" />

              <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={-greenScale} xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED" />
              <feColorMatrix in="GREEN_DISPLACED" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="GREEN_CHANNEL" />

              <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={-blueScale} xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED" />
              <feColorMatrix in="BLUE_DISPLACED" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="BLUE_CHANNEL" />

              <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
              <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
              <feGaussianBlur in="RGB_COMBINED" stdDeviation={Math.max(0.1, 0.5 - aberr * 0.1)} result="ABERRATED_BLURRED" />

              <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
              <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
                <feFuncA type="table" tableValues="1 0" />
              </feComponentTransfer>
              <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
              <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
            </filter>
          </defs>
        </svg>
      )}

      {/* Layer 1: Dark tint for overLight mode */}
      {overLight && (
        <span
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ background: "black", opacity: 0.15, mixBlendMode: "overlay" }}
        />
      )}

      {/* Layer 2: Glass — backdrop-filter for frost, CSS filter for SVG displacement */}
      {/* On mobile, backdrop-filter breaks inside overflow:hidden/auto containers (WebKit bug).
          Fall back to a semi-transparent background that simulates the frosted look. */}
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={
          isTouchDevice
            ? {
                background: `rgba(0, 0, 0, ${Math.min(0.55, 0.15 + blurAmount * 0.01)})`,
              }
            : {
                backdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
                WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
                filter: `url(#${filterId})`,
              }
        }
      />

      {/* Layer 3: Hover highlight — radial glow that follows cursor */}
      <span
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.2s ease-out",
          mixBlendMode: "overlay",
        }}
      />

      {/* Layer 4: Color tint overlay (two passes for visibility on any background) */}
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

      {/* Layer 6: Content */}
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
