"use client";

import React, { useRef, useCallback, useEffect, useState, useId } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import { generateGlassMaps, type GlassMapResult } from "./glass-map-generator";
import gsap from "gsap";

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  tint?: string;
  /**
   * Enable true optical refraction via the clone technique (same as
   * GlassCard / GlassSlider). Requires `captureRef` pointing at the
   * element whose subtree should be cloned and refracted through the
   * button.
   */
  refractive?: boolean;
  /**
   * Ref to a DOM element whose full subtree is cloned and refracted
   * through the button. Mark the button's ancestors/siblings that must
   * not be cloned with `data-refraction-ignore="true"`.
   */
  captureRef?: React.RefObject<HTMLElement | null>;
}

const sizeMap = {
  sm: { padding: "10px 20px", fontSize: "13px" },
  md: { padding: "14px 28px", fontSize: "15px" },
  lg: { padding: "18px 36px", fontSize: "17px" },
};

const CORNER_RADIUS = 100;

export default function GlassButton({
  children,
  onClick,
  className = "",
  size = "md",
  disabled = false,
  tint,
  refractive = false,
  captureRef,
}: GlassButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const cloneInnerRef = useRef<HTMLDivElement>(null);
  const { padding, fontSize } = sizeMap[size];

  const id = useId().replace(/:/g, "");
  const filterId = `button-${id}`;

  const [btnSize, setBtnSize] = useState({ w: 0, h: 0 });
  const [maps, setMaps] = useState<GlassMapResult | null>(null);

  // Measure the button element — maps need exact dimensions
  useEffect(() => {
    if (!refractive || !buttonRef.current) return;
    const measure = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setBtnSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(buttonRef.current);
    return () => ro.disconnect();
  }, [refractive]);

  // Generate physics-based displacement + specular maps
  useEffect(() => {
    if (!refractive || btnSize.w === 0 || btnSize.h === 0) return;
    setMaps(
      generateGlassMaps({
        width: btnSize.w,
        height: btnSize.h,
        radius: Math.min(CORNER_RADIUS, btnSize.h / 2),
        bezelWidth: Math.min(16, btnSize.h / 2),
        glassThickness: 80,
        refractiveIndex: 1.45,
      })
    );
  }, [refractive, btnSize.w, btnSize.h]);

  // DOM capture: clone captureRef's subtree into cloneInnerRef.
  // Hides (but does NOT remove) elements marked data-refraction-ignore="true"
  // — typically refractive glass components themselves, to prevent recursive
  // self-cloning. We use visibility:hidden so each hidden element keeps its
  // layout box; removing them would collapse surrounding flow content and
  // misalign the refracted scene with the real page.
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
  // Skips attribute mutations (GSAP-driven transforms on the wrapper would
  // otherwise trigger a re-clone on every frame) and ignores mutations
  // inside refraction-ignored subtrees.
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
    });
    return () => observer.disconnect();
  }, [refractive, captureRef, syncCapturedDom]);

  // Keep clone inner aligned with the captured anchor's bounding rect.
  const updateClonePosition = useCallback(() => {
    if (!buttonRef.current || !cloneInnerRef.current) return;
    const btnRect = buttonRef.current.getBoundingClientRect();
    const anchor = captureRef?.current ?? null;
    if (!anchor) return;
    const anchorRect = anchor.getBoundingClientRect();
    cloneInnerRef.current.style.width = `${anchorRect.width}px`;
    cloneInnerRef.current.style.height = `${anchorRect.height}px`;
    const offX = anchorRect.left - btnRect.left;
    const offY = anchorRect.top - btnRect.top;
    cloneInnerRef.current.style.transform = `translate(${offX}px, ${offY}px)`;
  }, [captureRef]);

  useEffect(() => {
    if (!refractive) return;
    updateClonePosition();
    const onScroll = () => updateClonePosition();
    const onResize = () => updateClonePosition();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const anchor = captureRef?.current ?? null;
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
  }, [refractive, updateClonePosition, captureRef]);

  const handleMouseEnter = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 1.05,
      duration: 0.3,
      ease: "back.out(1.7)",
      onUpdate: refractive ? updateClonePosition : undefined,
    });
  }, [disabled, refractive, updateClonePosition]);

  const handleMouseLeave = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 1,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
      onUpdate: refractive ? updateClonePosition : undefined,
    });
  }, [disabled, refractive, updateClonePosition]);

  const handleMouseDown = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 0.92,
      duration: 0.15,
      ease: "power2.out",
      onUpdate: refractive ? updateClonePosition : undefined,
    });
  }, [disabled, refractive, updateClonePosition]);

  const handleMouseUp = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 1.05,
      duration: 0.4,
      ease: "elastic.out(1, 0.4)",
      onUpdate: refractive ? updateClonePosition : undefined,
    });
  }, [disabled, refractive, updateClonePosition]);

  // Non-refractive path — original implementation, unchanged.
  if (!refractive) {
    return (
      <div
        ref={wrapperRef}
        className={`inline-block ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`}
        style={{ willChange: "transform" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <LiquidGlassWrap
          cornerRadius={CORNER_RADIUS}
          padding={padding}
          tint={tint}
          style={{ fontSize, fontWeight: 700 }}
          onClick={disabled ? undefined : onClick}
        >
          {children}
        </LiquidGlassWrap>
      </div>
    );
  }

  // Refractive path — clone technique with physics-based displacement.
  return (
    <div
      ref={wrapperRef}
      data-refraction-ignore="true"
      className={`inline-block ${disabled ? "opacity-40 pointer-events-none" : ""} ${className}`}
      style={{ willChange: "transform" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={buttonRef}
        className={`relative inline-block select-none ${disabled ? "" : "cursor-pointer"}`}
        onClick={disabled ? undefined : onClick}
        style={{
          padding,
          fontSize,
          fontWeight: 700,
          borderRadius: CORNER_RADIUS,
          boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
          overflow: "hidden",
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
                  width={btnSize.w} height={btnSize.h}
                  result="displacement_map"
                  href={maps.displacementMap}
                  preserveAspectRatio="none"
                />
                <feDisplacementMap
                  in="blurred_source"
                  in2="displacement_map"
                  scale={25}
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="displaced"
                />
                <feColorMatrix
                  in="displaced"
                  type="saturate"
                  values="5"
                  result="displaced_saturated"
                />
                <feImage
                  x="0" y="0"
                  width={btnSize.w} height={btnSize.h}
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
                <feBlend
                  in="specular_saturated"
                  in2="displaced"
                  mode="normal"
                  result="withSaturation"
                />
                <feBlend
                  in="specular_faded"
                  in2="withSaturation"
                  mode="normal"
                />
              </filter>
            </defs>
          </svg>
        )}

        {/* Clone layer: captured DOM refracted through the button */}
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
            style={{ top: 0, left: 0 }}
          />
        </div>

        {/* Subtle white tint for glass surface */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            background: "rgba(255, 255, 255, 0.04)",
            zIndex: 1,
          }}
        />

        {/* Optional colored tint overlay */}
        {tint && (
          <>
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: "inherit",
                background: tint,
                opacity: 0.55,
                zIndex: 1,
              }}
            />
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: "inherit",
                background: tint,
                mixBlendMode: "overlay",
                opacity: 0.6,
                zIndex: 1,
              }}
            />
          </>
        )}

        {/* Border shine (screen) */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            mixBlendMode: "screen",
            opacity: 0.25,
            padding: "1.5px",
            zIndex: 2,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.15) 33%, rgba(255,255,255,0.45) 66%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Border shine (overlay) */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: "inherit",
            mixBlendMode: "overlay",
            opacity: 0.9,
            padding: "1.5px",
            zIndex: 2,
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 33%, rgba(255,255,255,0.65) 66%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Content */}
        <span
          className="relative"
          style={{
            color: "white",
            textShadow: "0px 2px 12px rgba(0,0,0,0.4)",
            zIndex: 3,
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {children}
        </span>
      </div>
    </div>
  );
}
