"use client";

import React, { useRef, useCallback, useEffect, useState, useId } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import { generateGlassMaps, type GlassMapResult } from "./glass-map-generator";
import gsap from "gsap";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  cornerRadius?: number;
  padding?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /**
   * Enable true optical refraction via the clone technique.
   * When enabled, `renderScene` MUST be provided — the scene is cloned inside
   * the card and filtered through a physics-based displacement map.
   */
  refractive?: boolean;
  /**
   * Render function returning the background scene JSX to refract.
   * This should match whatever is behind the card on the page (e.g. wallpaper,
   * grid pattern, ambient orbs). Only used when `refractive` is true.
   */
  renderScene?: () => React.ReactNode;
  /**
   * Dimensions of the scene to clone (defaults to viewport).
   * Use when the scene is smaller than the viewport (e.g. a bounded demo area).
   */
  sceneSize?: { width: number; height: number };
  /**
   * Ref to the actual scene container on the page. When provided, the clone
   * matches the real scene's bounding rect exactly (size + position), so any
   * layout/sizing/position differences are eliminated. Preferred over
   * `sceneSize` when the page has scrollable content or a non-viewport-sized
   * scene container.
   */
  sceneRef?: React.RefObject<HTMLElement | null>;
  /**
   * Ref to a DOM element whose FULL subtree should be cloned and refracted
   * through the card. Use this to refract not just the background scene but
   * also foreground content (text, other components) that sits behind the card.
   *
   * The clone uses `Node.cloneNode(true)` + a `MutationObserver` to stay
   * in sync. Any element marked with `data-refraction-ignore="true"` (including
   * the card itself automatically) is stripped from the cloned tree to prevent
   * recursive self-cloning.
   *
   * When provided, this supersedes `renderScene`.
   */
  captureRef?: React.RefObject<HTMLElement | null>;
  /** Backdrop frosting strength in px (0 = clear, 40 = fully frosted). Default 0. */
  blurAmount?: number;
  /** Backdrop saturation %. Default 140. */
  saturation?: number;
  /** Cursor-following stretch factor (0 = static, 1 = max follow). Default 0. */
  elasticity?: number;
  /** Refraction intensity via SVG displacement. Default 100. */
  displacementScale?: number;
  /** Dark tint for bright backgrounds. Halves text-shadow. */
  overLight?: boolean;
  /** Drop shadow depth (0–2). Default 1. */
  shadowIntensity?: number;
  /** Border shine visibility (0–1). Default 1. */
  borderOpacity?: number;
  /** Colored overlay, e.g. `rgba(99,102,241,0.3)`. */
  tint?: string;
}

export default function GlassCard({
  children,
  className = "",
  draggable = false,
  cornerRadius = 24,
  padding = "24px 28px",
  style,
  onClick,
  refractive = false,
  renderScene,
  sceneSize,
  sceneRef,
  captureRef,
  blurAmount,
  saturation,
  elasticity,
  displacementScale,
  overLight,
  shadowIntensity,
  borderOpacity,
  tint,
}: GlassCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cloneInnerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const borderScreenRef = useRef<HTMLSpanElement>(null);
  const borderOverlayRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [maps, setMaps] = useState<GlassMapResult | null>(null);
  const dragState = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  const id = useId().replace(/:/g, "");
  const filterId = `card-${id}`;

  // Measure card size and generate displacement maps
  useEffect(() => {
    if (!refractive || !cardRef.current) return;
    const measure = () => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [refractive]);

  // Generate physics-based maps when size is known
  useEffect(() => {
    if (!refractive || size.w === 0 || size.h === 0) return;
    setMaps(
      generateGlassMaps({
        width: size.w,
        height: size.h,
        radius: cornerRadius,
        bezelWidth: Math.min(24, cornerRadius),
        glassThickness: 100,
        refractiveIndex: 1.45,
      })
    );
  }, [refractive, size.w, size.h, cornerRadius]);

  // DOM capture: clone the captureRef element's subtree into cloneInnerRef.
  // Hides (but does NOT remove) elements marked data-refraction-ignore="true"
  // — typically refractive glass components themselves, to prevent recursive
  // self-cloning. We use visibility:hidden so the element keeps its layout
  // box; removing it would collapse surrounding flow content and misalign
  // the refracted scene with the real page.
  const syncCapturedDom = useCallback(() => {
    if (!captureRef?.current || !cloneInnerRef.current) return;
    const snapshot = captureRef.current.cloneNode(true) as HTMLElement;
    snapshot
      .querySelectorAll('[data-refraction-ignore="true"]')
      .forEach((el) => {
        if (el instanceof HTMLElement) el.style.visibility = "hidden";
      });
    cloneInnerRef.current.replaceChildren(snapshot);
  }, [captureRef]);

  // Initial capture + keep in sync via MutationObserver.
  // We DO NOT observe `attributes` because GSAP sets `transform` on the
  // wrapper during drag — that would trigger a re-clone on every frame and
  // tank performance. We only re-clone when actual content changes
  // (childList added/removed, text edited). Mutations inside elements marked
  // `data-refraction-ignore="true"` (cards, their wrappers) are filtered out.
  useEffect(() => {
    if (!refractive || !captureRef?.current) return;
    syncCapturedDom();

    const isIgnored = (node: Node | null): boolean => {
      let cur: Node | null = node;
      while (cur) {
        if (
          cur instanceof HTMLElement &&
          cur.dataset.refractionIgnore === "true"
        ) {
          return true;
        }
        cur = cur.parentNode;
      }
      return false;
    };

    let rafPending = false;
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations that happen entirely inside refraction-ignored subtrees
      const relevant = mutations.some((m) => !isIgnored(m.target));
      if (!relevant || rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        syncCapturedDom();
      });
    });
    observer.observe(captureRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
      // attributes: false — intentional, see comment above
    });
    return () => observer.disconnect();
  }, [refractive, captureRef, syncCapturedDom]);

  // Keep clone inner aligned with the real scene's position & size.
  // If a sceneRef is provided, we mirror its exact bounding rect (size +
  // offset). Otherwise we fall back to viewport-sized positioning.
  const updateClonePosition = useCallback(() => {
    if (!cardRef.current || !cloneInnerRef.current) return;
    const cardRect = cardRef.current.getBoundingClientRect();
    // Prefer captureRef over sceneRef — captureRef represents the full content
    // area whose DOM is cloned, so its rect defines the clone coordinate system.
    const anchor = captureRef?.current ?? sceneRef?.current ?? null;
    if (anchor) {
      const anchorRect = anchor.getBoundingClientRect();
      cloneInnerRef.current.style.width = `${anchorRect.width}px`;
      cloneInnerRef.current.style.height = `${anchorRect.height}px`;
      const offX = anchorRect.left - cardRect.left;
      const offY = anchorRect.top - cardRect.top;
      cloneInnerRef.current.style.transform = `translate(${offX}px, ${offY}px)`;
    } else {
      cloneInnerRef.current.style.transform = `translate(${-cardRect.left}px, ${-cardRect.top}px)`;
    }
  }, [sceneRef, captureRef]);

  useEffect(() => {
    if (!refractive) return;
    updateClonePosition();
    const onScroll = () => updateClonePosition();
    const onResize = () => updateClonePosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // ResizeObserver on the capture/scene anchor so we react to layout changes
    const anchor = captureRef?.current ?? sceneRef?.current ?? null;
    let ro: ResizeObserver | null = null;
    if (anchor) {
      ro = new ResizeObserver(() => updateClonePosition());
      ro.observe(anchor);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [refractive, updateClonePosition, captureRef, sceneRef]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!draggable || !wrapperRef.current) return;
      dragState.current = { isDragging: true, lastX: e.clientX, lastY: e.clientY };
      wrapperRef.current.setPointerCapture(e.pointerId);
      gsap.to(wrapperRef.current, { scale: 1.03, duration: 0.3, ease: "back.out(1.7)" });
    },
    [draggable]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDragging || !wrapperRef.current) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    gsap.set(wrapperRef.current, { x: `+=${dx}`, y: `+=${dy}` });
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    // Keep the clone aligned with the card's new position during drag
    if (refractive) updateClonePosition();
  }, [refractive, updateClonePosition]);

  const handlePointerUp = useCallback(() => {
    if (!dragState.current.isDragging || !wrapperRef.current) return;
    dragState.current.isDragging = false;
    gsap.to(wrapperRef.current, {
      scale: 1,
      duration: 0.5,
      ease: "elastic.out(1, 0.5)",
      onUpdate: refractive ? updateClonePosition : undefined,
    });
  }, [refractive, updateClonePosition]);

  // Cursor-following radial glow + dynamic border shine + elasticity for the
  // refractive path. We update DOM styles directly (via refs) rather than React
  // state so we don't trigger a re-render on every mouse move.
  const handleCardMouseMove = useCallback((e: React.MouseEvent) => {
    if (!refractive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const offX = ((e.clientX - cx) / rect.width) * 100;
    const offY = ((e.clientY - cy) / rect.height) * 100;
    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;

    // Elasticity: translate + directional stretch toward the cursor.
    // Applied directly to cardRef.style.transform — does NOT collide with the
    // wrapperRef's GSAP-driven drag transforms.
    if (elasticity && elasticity > 0) {
      const deltaX = e.clientX - cx;
      const deltaY = e.clientY - cy;
      const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const tx = deltaX * elasticity * 0.06;
      const ty = deltaY * elasticity * 0.06;
      const normX = dist > 0 ? Math.abs(deltaX / dist) : 0;
      const normY = dist > 0 ? Math.abs(deltaY / dist) : 0;
      const stretch = Math.min(dist / 400, 1) * elasticity;
      const sx = 1 + normX * stretch * 0.12 - normY * stretch * 0.06;
      const sy = 1 + normY * stretch * 0.12 - normX * stretch * 0.06;
      cardRef.current.style.transform = `translate(${tx}px, ${ty}px) scaleX(${Math.max(0.9, sx)}) scaleY(${Math.max(0.9, sy)})`;
      cardRef.current.style.transition = "transform 0.15s ease-out";
      // Re-pin the clone after the transform shifts the card's BCR
      updateClonePosition();
    }

    if (glowRef.current) {
      glowRef.current.style.background = `radial-gradient(circle at ${posX}% ${posY}%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)`;
    }

    const gradAngle = 135 + offX * 1.2;
    const gradStop1 = Math.max(10, 33 + offY * 0.3);
    const gradStop2 = Math.min(90, 66 + offY * 0.4);
    const screenA1 = 0.12 + Math.abs(offX) * 0.008;
    const screenA2 = 0.4 + Math.abs(offX) * 0.012;
    const overlayA1 = 0.32 + Math.abs(offX) * 0.008;
    const overlayA2 = 0.6 + Math.abs(offX) * 0.012;

    if (borderScreenRef.current) {
      borderScreenRef.current.style.background = `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${screenA1}) ${gradStop1}%, rgba(255,255,255,${screenA2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`;
    }
    if (borderOverlayRef.current) {
      borderOverlayRef.current.style.background = `linear-gradient(${gradAngle}deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${overlayA1}) ${gradStop1}%, rgba(255,255,255,${overlayA2}) ${gradStop2}%, rgba(255,255,255,0) 100%)`;
    }
  }, [refractive, elasticity, updateClonePosition]);

  const handleCardMouseEnter = useCallback(() => {
    if (!refractive || !glowRef.current) return;
    glowRef.current.style.opacity = "1";
  }, [refractive]);

  const handleCardMouseLeave = useCallback(() => {
    if (!refractive) return;
    if (glowRef.current) glowRef.current.style.opacity = "0";
    if (elasticity && elasticity > 0 && cardRef.current) {
      cardRef.current.style.transform = "";
      // Re-pin once the spring-back transition starts
      updateClonePosition();
    }
  }, [refractive, elasticity, updateClonePosition]);

  // Non-refractive path — original implementation
  if (!refractive) {
    return (
      <div
        ref={wrapperRef}
        className={draggable ? "cursor-grab active:cursor-grabbing select-none" : ""}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: draggable ? "none" : undefined, willChange: "transform" }}
      >
        <LiquidGlassWrap
          cornerRadius={cornerRadius}
          padding={padding}
          style={style}
          className={className}
          blurAmount={blurAmount}
          saturation={saturation}
          elasticity={elasticity}
          displacementScale={displacementScale}
          overLight={overLight}
          shadowIntensity={shadowIntensity}
          borderOpacity={borderOpacity}
          tint={tint}
          onClick={onClick}
        >
          {children}
        </LiquidGlassWrap>
      </div>
    );
  }

  // Refractive path — clone technique with physics-based displacement
  const sceneW = sceneSize?.width ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
  const sceneH = sceneSize?.height ?? (typeof window !== "undefined" ? window.innerHeight : 1080);

  return (
    <div
      ref={wrapperRef}
      data-refraction-ignore="true"
      className={draggable ? "cursor-grab active:cursor-grabbing select-none" : ""}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: draggable ? "none" : undefined, willChange: "transform" }}
    >
      <div
        ref={cardRef}
        className={`relative ${className}`}
        onMouseEnter={handleCardMouseEnter}
        onMouseMove={handleCardMouseMove}
        onMouseLeave={handleCardMouseLeave}
        style={{
          borderRadius: cornerRadius,
          padding,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          overflow: "hidden",
          ...style,
        }}
      >
        {/* SVG Filter — physics-based displacement + specular */}
        {maps && (
          <svg
            style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
            aria-hidden="true"
          >
            <defs>
              <filter
                id={filterId}
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation="0" result="blurred_source" />
                <feImage
                  x="0" y="0"
                  width={size.w} height={size.h}
                  result="displacement_map"
                  href={maps.displacementMap}
                  preserveAspectRatio="none"
                />
                <feDisplacementMap
                  in="blurred_source"
                  in2="displacement_map"
                  scale={30}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="displaced"
                />
                <feColorMatrix in="displaced" type="saturate" values="4" result="displaced_saturated" />
                <feImage
                  x="0" y="0"
                  width={size.w} height={size.h}
                  result="specular_layer"
                  href={maps.specularMap}
                  preserveAspectRatio="none"
                />
                <feComposite
                  in="displaced_saturated"
                  in2="specular_layer"
                  operator="in"
                  result="specular_saturated"
                />
                <feComponentTransfer in="specular_layer" result="specular_faded">
                  <feFuncA type="linear" slope="0.4" />
                </feComponentTransfer>
                <feBlend in="specular_saturated" in2="displaced" mode="normal" result="withSaturation" />
                <feBlend in="specular_faded" in2="withSaturation" mode="normal" />
              </filter>
            </defs>
          </svg>
        )}

        {/* Clone layer: the refracted scene (or full DOM capture) */}
        {refractive && (renderScene || captureRef) && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "inherit",
              overflow: "hidden",
              zIndex: 0,
              filter: maps ? `url(#${filterId})` : undefined,
            }}
          >
            <div
              ref={cloneInnerRef}
              className="absolute pointer-events-none"
              style={{
                top: 0,
                left: 0,
                width: sceneW,
                height: sceneH,
              }}
            >
              {/* When captureRef is provided, cloneInner's children are
                  managed imperatively by the syncCapturedDom effect.
                  Otherwise, renderScene provides the JSX. */}
              {!captureRef && renderScene && renderScene()}
            </div>
          </div>
        )}

        {/* Frost layer — backdrop blur + saturation over the refracted clone */}
        {blurAmount && blurAmount > 0 ? (
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "inherit",
              backdropFilter: `blur(${blurAmount}px) saturate(${saturation ?? 140}%)`,
              WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturation ?? 140}%)`,
              zIndex: 1,
            }}
          />
        ) : null}

        {/* Glass surface overlay — subtle tint + border shines */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            background: "rgba(255, 255, 255, 0.04)",
            zIndex: 1,
          }}
        />

        {/* Radial glow that follows the cursor (mix-blend: overlay) */}
        <span
          ref={glowRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)",
            opacity: 0,
            transition: "opacity 0.2s ease-out",
            mixBlendMode: "overlay",
            zIndex: 1,
          }}
        />

        {/* Border shine (screen) — gradient shifts with cursor */}
        <span
          ref={borderScreenRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            mixBlendMode: "screen",
            opacity: 0.25,
            padding: "1.5px",
            zIndex: 2,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 33%, rgba(255,255,255,0.45) 66%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Border shine (overlay) — gradient shifts with cursor */}
        <span
          ref={borderOverlayRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            mixBlendMode: "overlay",
            opacity: 0.9,
            padding: "1.5px",
            zIndex: 2,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 33%, rgba(255,255,255,0.65) 66%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Content */}
        <div
          className="relative"
          style={{
            color: "white",
            textShadow: "0px 2px 12px rgba(0,0,0,0.4)",
            zIndex: 3,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
