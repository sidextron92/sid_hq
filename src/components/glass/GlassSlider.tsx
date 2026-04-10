"use client";

import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import { DISPLACEMENT_MAP } from "./displacement-map";
import gsap from "gsap";

interface GlassSliderProps {
  /** Current value (controlled mode) */
  value?: number;
  /** Default value (uncontrolled mode) */
  defaultValue?: number;
  /** Callback fired on value change */
  onChange?: (value: number) => void;
  /** Minimum value. Default 0. */
  min?: number;
  /** Maximum value. Default 100. */
  max?: number;
  /** Step increment. Default 1. */
  step?: number;
  /** Disable interaction. Default false. */
  disabled?: boolean;
  /** Show floating label with current value on drag. Default false. */
  showLabel?: boolean;
  /** Format the displayed label value */
  formatLabel?: (value: number) => string;
  /** Labels to show below the track at evenly-spaced step positions */
  stepLabels?: string[];
  /** Additional class name */
  className?: string;
  /** Visual scale factor. Default 1. */
  scale?: number;
}

const SCALE_REST = 0.65;
const SCALE_GLASS = 0.9;

const TRACK_W = 320;
const TRACK_H = 16;
const TRACK_R = TRACK_H / 2;
const THUMB_W = 56;
const THUMB_H = 44;
const THUMB_RX = THUMB_H / 2;
// Account for visual thumb width at rest scale so it reaches both edges
const THUMB_VISUAL_W = THUMB_W * SCALE_REST;
const THUMB_OFFSET = (THUMB_W - THUMB_VISUAL_W) / 2;
const TRAVEL = TRACK_W - THUMB_VISUAL_W;

const FILL_COLOR = "rgba(48, 130, 246, 0.85)";
const FILL_COLOR_GLASS = "rgba(48, 130, 246, 0.25)";

export default function GlassSlider({
  value,
  defaultValue,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  showLabel = false,
  formatLabel,
  stepLabels,
  className = "",
  scale: visualScale = 1,
}: GlassSliderProps) {
  const id = useId().replace(/:/g, "");
  const thumbFilterId = `slider-thumb-${id}`;
  const fillFilterId = `slider-fill-${id}`;
  const unfillFilterId = `slider-unfill-${id}`;

  const initialValue = value ?? defaultValue ?? min;
  const [internalValue, setInternalValue] = useState(initialValue);
  const valueRef = useRef(initialValue);

  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const thumbBgRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const unfillRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const isPressing = useRef(false);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);

  const valueToX = useCallback(
    (v: number) => ((v - min) / (max - min)) * TRAVEL,
    [min, max]
  );

  const xToValue = useCallback(
    (x: number) => {
      const raw = min + (x / TRAVEL) * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.min(max, Math.max(min, parseFloat(stepped.toFixed(10))));
    },
    [min, max, step]
  );

  const halfThumb = THUMB_VISUAL_W / 2;

  // Sync controlled value
  useEffect(() => {
    if (value === undefined) return;
    valueRef.current = value;
    setInternalValue(value);
    const x = valueToX(value);
    if (thumbRef.current)
      gsap.to(thumbRef.current, { x, duration: 0.4, ease: "elastic.out(1, 0.65)" });
    if (fillRef.current)
      gsap.to(fillRef.current, { width: x + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.65)" });
    if (unfillRef.current)
      gsap.to(unfillRef.current, { left: x + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.65)" });
    if (labelRef.current)
      gsap.to(labelRef.current, { x: x + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.65)" });
  }, [value, valueToX, halfThumb]);

  // Set initial position (no animation)
  useEffect(() => {
    const x = valueToX(valueRef.current);
    if (thumbRef.current) gsap.set(thumbRef.current, { x, scale: SCALE_REST });
    if (fillRef.current) gsap.set(fillRef.current, { width: x + halfThumb });
    if (unfillRef.current) gsap.set(unfillRef.current, { left: x + halfThumb });
    if (labelRef.current) gsap.set(labelRef.current, { x: x + halfThumb });
    if (thumbBgRef.current)
      gsap.set(thumbBgRef.current, { backgroundColor: "rgba(255, 255, 255, 1)" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePositions = useCallback(
    (x: number, animate: boolean) => {
      const opts = animate
        ? { duration: 0.5, ease: "elastic.out(1, 0.6)" }
        : { duration: 0 };
      if (thumbRef.current) gsap.to(thumbRef.current, { x, ...opts });
      if (fillRef.current) gsap.to(fillRef.current, { width: x + halfThumb, ...opts });
      if (unfillRef.current) gsap.to(unfillRef.current, { left: x + halfThumb, ...opts });
      if (labelRef.current) gsap.to(labelRef.current, { x: x + halfThumb, ...opts });
    },
    [halfThumb]
  );

  const commitValue = useCallback(
    (v: number) => {
      valueRef.current = v;
      setInternalValue(v);
      onChange?.(v);
    },
    [onChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      isPressing.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      // Calculate click position relative to track
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left - halfThumb;
      const clampedClick = Math.max(0, Math.min(TRAVEL, clickX));
      const clickedValue = xToValue(clampedClick);
      const snappedX = valueToX(clickedValue);

      // Jump thumb to clicked position
      commitValue(clickedValue);
      updatePositions(snappedX, true);
      if (labelRef.current) {
        labelRef.current.textContent =
          formatLabel?.(clickedValue) ?? String(clickedValue);
      }

      dragStartX.current = e.clientX;
      dragStartValue.current = clickedValue;

      // Thumb press: expand to glass mode (like TactileSwitch)
      if (thumbRef.current) {
        gsap.to(thumbRef.current, {
          scale: SCALE_GLASS,
          duration: 0.3,
          ease: "back.out(1.4)",
        });
      }
      if (thumbBgRef.current) {
        gsap.to(thumbBgRef.current, {
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          duration: 0.25,
          ease: "power2.out",
        });
      }
      // Show label
      if (labelRef.current) {
        gsap.to(labelRef.current, {
          opacity: 1,
          y: -4,
          duration: 0.2,
          ease: "back.out(1.4)",
        });
      }
    },
    [disabled, xToValue, valueToX, commitValue, updatePositions, formatLabel, halfThumb]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing.current) return;

      const dx = e.clientX - dragStartX.current;
      const baseX = valueToX(dragStartValue.current);
      const rawX = baseX + dx;
      const clampedX = Math.max(0, Math.min(TRAVEL, rawX));

      // Free drag — move thumb to raw position, don't snap yet
      if (thumbRef.current) gsap.set(thumbRef.current, { x: clampedX });
      if (fillRef.current) gsap.set(fillRef.current, { width: clampedX + halfThumb });
      if (unfillRef.current) gsap.set(unfillRef.current, { left: clampedX + halfThumb });
      if (labelRef.current) gsap.set(labelRef.current, { x: clampedX + halfThumb });

      // Track the closest snapped value for label display
      const newValue = xToValue(clampedX);
      valueRef.current = newValue;

      if (labelRef.current) {
        labelRef.current.textContent =
          formatLabel?.(newValue) ?? String(newValue);
      }
    },
    [valueToX, xToValue, formatLabel, halfThumb]
  );

  const handlePointerUp = useCallback(() => {
    if (disabled || !isPressing.current) return;
    isPressing.current = false;

    // Snap to nearest step on release
    const snappedValue = valueRef.current;
    const snappedX = valueToX(snappedValue);
    commitValue(snappedValue);
    onChange?.(snappedValue);

    // Animate thumb to snapped position
    if (thumbRef.current) gsap.to(thumbRef.current, { x: snappedX, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (fillRef.current) gsap.to(fillRef.current, { width: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (unfillRef.current) gsap.to(unfillRef.current, { left: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (labelRef.current) gsap.to(labelRef.current, { x: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });

    // Thumb release: shrink back to rest (like TactileSwitch)
    if (thumbRef.current) {
      gsap.to(thumbRef.current, {
        scale: SCALE_REST,
        duration: 0.5,
        ease: "elastic.out(1, 0.7)",
      });
    }
    if (thumbBgRef.current) {
      gsap.to(thumbBgRef.current, {
        backgroundColor: "rgba(255, 255, 255, 1)",
        duration: 0.35,
        ease: "power2.out",
      });
    }
    // Hide label
    if (labelRef.current) {
      gsap.to(labelRef.current, {
        opacity: 0,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    }
  }, [disabled, commitValue]);

  const displayValue = formatLabel?.(internalValue) ?? String(internalValue);

  return (
    <div
      className={`inline-block ${className}`}
      style={{
        transform: visualScale !== 1 ? `scale(${visualScale})` : undefined,
        transformOrigin: "center center",
      }}
    >
      {/* SVG Filters */}
      <svg
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        aria-hidden="true"
      >
        <defs>
          {/* Thumb displacement (same as TactileSwitch) */}
          <filter
            id={thumbFilterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="0.2"
              result="blurred_source"
            />
            <feImage
              x="0" y="0" width="100%" height="100%"
              result="displacement_map"
              href={DISPLACEMENT_MAP}
              preserveAspectRatio="xMidYMid slice"
            />
            <feDisplacementMap
              in="blurred_source"
              in2="displacement_map"
              scale={35}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="saturate"
              values="6"
              result="displaced_saturated"
            />
          </filter>

          {/* Filled region — light refraction ("clear glass") */}
          <filter
            id={fillFilterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="0.3"
              result="blurred_source"
            />
            <feImage
              x="0" y="0" width="100%" height="100%"
              result="displacement_map"
              href={DISPLACEMENT_MAP}
              preserveAspectRatio="xMidYMid slice"
            />
            <feDisplacementMap
              in="blurred_source"
              in2="displacement_map"
              scale={15}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="saturate"
              values="3"
              result="displaced_saturated"
            />
          </filter>

          {/* Unfilled region — heavy refraction ("frosted glass") */}
          <filter
            id={unfillFilterId}
            x="-35%"
            y="-35%"
            width="170%"
            height="170%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="1.2"
              result="blurred_source"
            />
            <feImage
              x="0" y="0" width="100%" height="100%"
              result="displacement_map"
              href={DISPLACEMENT_MAP}
              preserveAspectRatio="xMidYMid slice"
            />
            <feDisplacementMap
              in="blurred_source"
              in2="displacement_map"
              scale={50}
              xChannelSelector="R"
              yChannelSelector="G"
              result="displaced"
            />
            <feColorMatrix
              in="displaced"
              type="saturate"
              values="6"
              result="displaced_saturated"
            />
          </filter>
        </defs>
      </svg>

      {/* Track */}
      <div
        ref={trackRef}
        className={`relative ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_R,
          backgroundColor: "rgba(0, 0, 0, 0.15)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
          touchAction: "none",
          overflow: "visible",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Filled region — blue glass with convex specular */}
        <span
          ref={fillRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            height: TRACK_H,
            borderRadius: TRACK_R,
            overflow: "hidden",
            backdropFilter: `url(#${fillFilterId}) blur(2px) saturate(120%)`,
            WebkitBackdropFilter: `url(#${fillFilterId}) blur(2px) saturate(120%)`,
            backgroundColor: FILL_COLOR,
          }}
        >
          {/* Convex bezel specular highlight */}
          <span
            className="absolute inset-0"
            style={{
              borderRadius: TRACK_R,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 60%, rgba(0,0,0,0.08) 100%)",
            }}
          />
        </span>

        {/* Unfilled region — frosted refractive glass */}
        <span
          ref={unfillRef}
          className="absolute top-0 pointer-events-none"
          style={{
            right: 0,
            height: TRACK_H,
            borderRadius: TRACK_R,
            overflow: "hidden",
            backdropFilter: `url(#${unfillFilterId}) blur(8px) saturate(160%)`,
            WebkitBackdropFilter: `url(#${unfillFilterId}) blur(8px) saturate(160%)`,
            backgroundColor: "rgba(148, 148, 159, 0.25)",
          }}
        />

        {/* Track border shine (screen) */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: TRACK_R,
            mixBlendMode: "screen",
            opacity: 0.15,
            padding: "1.5px",
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

        {/* Track border shine (overlay) */}
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: TRACK_R,
            mixBlendMode: "overlay",
            opacity: 0.8,
            padding: "1.5px",
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

        {/* Thumb — pill shape like TactileSwitch */}
        <div
          ref={thumbRef}
          className="absolute select-none pointer-events-none"
          style={{
            width: THUMB_W,
            height: THUMB_H,
            borderRadius: THUMB_RX,
            top: TRACK_H / 2,
            marginLeft: -THUMB_OFFSET,
            transform: `translateY(-50%) scale(${SCALE_REST})`,
            willChange: "transform",
            overflow: "hidden",
            zIndex: 2,
          }}
        >
          {/* Backdrop warp layer */}
          <span
            className="absolute inset-0"
            style={{
              borderRadius: THUMB_RX,
              backdropFilter: `url(#${thumbFilterId})`,
              WebkitBackdropFilter: `url(#${thumbFilterId})`,
            }}
          />

          {/* Thumb background (opaque at rest, transparent when pressed) */}
          <div
            ref={thumbBgRef}
            className="absolute inset-0"
            style={{
              borderRadius: THUMB_RX,
              backgroundColor: "rgba(255, 255, 255, 1)",
              boxShadow:
                "0 4px 22px rgba(0,0,0,0.1)",
            }}
          />

          {/* Thumb border shine (screen) */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: THUMB_RX,
              mixBlendMode: "screen",
              opacity: 0.25,
              padding: "1.5px",
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

          {/* Thumb border shine (overlay) */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: THUMB_RX,
              mixBlendMode: "overlay",
              padding: "1.5px",
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
        </div>

        {/* Floating label */}
        {showLabel && (
          <span
            ref={labelRef}
            className="absolute pointer-events-none select-none"
            style={{
              bottom: TRACK_H / 2 + THUMB_H * SCALE_REST / 2 + 10,
              left: 0,
              transform: "translateX(-50%)",
              fontSize: 13,
              fontWeight: 700,
              color: "white",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              opacity: 0,
              whiteSpace: "nowrap",
              willChange: "transform, opacity",
            }}
          >
            {displayValue}
          </span>
        )}
      </div>

      {/* Step labels below track */}
      {stepLabels && stepLabels.length > 0 && (
        <div
          className="flex justify-between pointer-events-none select-none"
          style={{
            width: TRACK_W,
            marginTop: 6,
          }}
        >
          {stepLabels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] font-bold uppercase"
              style={{
                color: "rgba(255,255,255,0.35)",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                textAlign: i === 0 ? "left" : i === stepLabels.length - 1 ? "right" : "center",
                flex: i === 0 || i === stepLabels.length - 1 ? undefined : 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
