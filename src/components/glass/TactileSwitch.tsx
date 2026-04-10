"use client";

import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import { DISPLACEMENT_MAP } from "./displacement-map";
import gsap from "gsap";

interface TactileSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  /** Visual scale factor (e.g. 0.5 = half size). Default 1. */
  scale?: number;
}

const TRACK_W = 160;
const TRACK_H = 67;
const THUMB_W = 146;
const THUMB_H = 92;
const TRACK_R = TRACK_H / 2;
const THUMB_R = THUMB_H / 2;

const SCALE_REST = 0.65;
const SCALE_GLASS = 0.9;
const TRAVEL = 57.9;

export default function TactileSwitch({
  checked = false,
  onChange,
  disabled = false,
  className = "",
  scale: visualScale = 1,
}: TactileSwitchProps) {
  const id = useId().replace(/:/g, "");
  const filterId = `switch-thumb-${id}`;
  const [isOn, setIsOn] = useState(checked);
  const isOnRef = useRef(checked);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbBgRef = useRef<HTMLDivElement>(null);
  const isPressing = useRef(false);
  const dragStartX = useRef(0);
  const didDrag = useRef(false);

  useEffect(() => {
    setIsOn(checked);
    isOnRef.current = checked;
  }, [checked]);

  // Set initial position (no animation)
  useEffect(() => {
    if (!thumbRef.current || !trackRef.current || !thumbBgRef.current) return;
    gsap.set(thumbRef.current, {
      x: isOnRef.current ? TRAVEL : 0,
      scale: SCALE_REST,
    });
    gsap.set(trackRef.current, {
      backgroundColor: isOnRef.current
        ? "rgba(59, 191, 78, 0.93)"
        : "rgba(148, 148, 159, 0.47)",
    });
    gsap.set(thumbBgRef.current, {
      backgroundColor: "rgba(255, 255, 255, 1)",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commit to a new state (shared by drag-release and tap-release)
  const commitToggle = useCallback(
    (next: boolean) => {
      isOnRef.current = next;
      setIsOn(next);
      onChange?.(next);

      if (!thumbRef.current || !trackRef.current || !thumbBgRef.current) return;

      const xTarget = next ? TRAVEL : 0;
      const trackColor = next
        ? "rgba(59, 191, 78, 0.93)"
        : "rgba(148, 148, 159, 0.47)";

      gsap.to(thumbRef.current, {
        x: xTarget,
        scale: SCALE_REST,
        duration: 0.5,
        ease: "elastic.out(1, 0.7)",
      });

      gsap.to(trackRef.current, {
        backgroundColor: trackColor,
        duration: 0.4,
        ease: "power2.out",
      });

      gsap.to(thumbBgRef.current, {
        backgroundColor: "rgba(255, 255, 255, 1)",
        duration: 0.35,
        ease: "power2.out",
      });
    },
    [onChange]
  );

  // PRESS DOWN: expand to glass mode, record start position
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      isPressing.current = true;
      didDrag.current = false;
      dragStartX.current = e.clientX;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      if (!thumbRef.current || !thumbBgRef.current) return;

      // Expand thumb to glass mode
      gsap.to(thumbRef.current, {
        scale: SCALE_GLASS,
        duration: 0.3,
        ease: "back.out(1.4)",
      });

      gsap.to(thumbBgRef.current, {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        duration: 0.25,
        ease: "power2.out",
      });
    },
    [disabled]
  );

  // DRAG: move thumb between 0 and TRAVEL, interpolate track color
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing.current || !thumbRef.current || !trackRef.current) return;

      const dx = e.clientX - dragStartX.current;
      // Only start treating as drag after 4px movement
      if (Math.abs(dx) > 4) {
        didDrag.current = true;
      }
      if (!didDrag.current) return;

      const currentBase = isOnRef.current ? TRAVEL : 0;
      const rawX = currentBase + dx;
      const clampedX = Math.max(0, Math.min(TRAVEL, rawX));
      const progress = clampedX / TRAVEL; // 0..1

      gsap.set(thumbRef.current, { x: clampedX });

      // Interpolate track color based on drag progress
      const r = Math.round(148 + (59 - 148) * progress);
      const g = Math.round(148 + (191 - 148) * progress);
      const b = Math.round(159 + (78 - 159) * progress);
      const a = (0.47 + (0.93 - 0.47) * progress).toFixed(2);
      gsap.set(trackRef.current, {
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
      });
    },
    []
  );

  // RELEASE: determine final state from thumb position (drag) or toggle (tap)
  const handlePointerUp = useCallback(() => {
    if (disabled || !isPressing.current) return;
    isPressing.current = false;

    if (didDrag.current && thumbRef.current) {
      // Determine state from current thumb position
      const transform = gsap.getProperty(thumbRef.current, "x") as number;
      const progress = transform / TRAVEL;
      // If dragged past halfway, commit to that side
      const next = progress > 0.5;
      commitToggle(next);
    } else {
      // Simple tap — toggle
      commitToggle(!isOnRef.current);
    }
  }, [disabled, commitToggle]);

  return (
    <div
      className={`inline-block ${className}`}
      style={{
        transform: visualScale !== 1 ? `scale(${visualScale})` : undefined,
        transformOrigin: "center center",
      }}
    >
    <div
      ref={trackRef}
      className={`relative inline-block ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}
      style={{
        width: TRACK_W,
        height: TRACK_H,
        borderRadius: TRACK_R,
        backgroundColor: "rgba(148, 148, 159, 0.47)",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Thumb */}
      <div
        ref={thumbRef}
        className="absolute select-none pointer-events-none"
        style={{
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: THUMB_R,
          top: TRACK_H / 2,
          marginLeft: -22,
          transform: `translateY(-50%) scale(${SCALE_REST})`,
          willChange: "transform",
          overflow: "hidden",
        }}
      >
        {/* SVG displacement filter */}
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
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.2" result="blurred_source" />
              <feImage
                x="0" y="0" width="100%" height="100%"
                result="displacement_map"
                href={DISPLACEMENT_MAP}
                preserveAspectRatio="xMidYMid slice"
              />
              <feDisplacementMap
                in="blurred_source" in2="displacement_map"
                scale={35}
                xChannelSelector="R" yChannelSelector="G"
                result="displaced"
              />
              <feColorMatrix
                in="displaced" type="saturate" values="6"
                result="displaced_saturated"
              />
            </filter>
          </defs>
        </svg>

        {/* Backdrop warp layer */}
        <span
          className="absolute inset-0"
          style={{
            borderRadius: THUMB_R,
            backdropFilter: `url(#${filterId})`,
            WebkitBackdropFilter: `url(#${filterId})`,
          }}
        />

        {/* Thumb background (opaque at rest, transparent when pressed) */}
        <div
          ref={thumbBgRef}
          className="absolute inset-0"
          style={{
            borderRadius: THUMB_R,
            backgroundColor: "rgba(255, 255, 255, 1)",
            boxShadow: "0 4px 22px rgba(0,0,0,0.1)",
          }}
        />

        {/* Border shine (screen) */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: THUMB_R,
            mixBlendMode: "screen",
            opacity: 0.25,
            padding: "1.5px",
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
            borderRadius: THUMB_R,
            mixBlendMode: "overlay",
            padding: "1.5px",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.5) inset, 0 1px 3px rgba(255,255,255,0.25) inset",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 33%, rgba(255,255,255,0.65) 66%, rgba(255,255,255,0) 100%)",
          }}
        />
      </div>
    </div>
    </div>
  );
}
