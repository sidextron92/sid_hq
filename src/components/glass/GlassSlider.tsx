"use client";

import React, { useRef, useEffect, useState, useCallback, useId } from "react";
import { generateGlassMaps, type GlassMapResult } from "./glass-map-generator";
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
const THUMB_VISUAL_W = THUMB_W * SCALE_REST;
const THUMB_OFFSET = (THUMB_W - THUMB_VISUAL_W) / 2;
const TRAVEL = TRACK_W - THUMB_VISUAL_W;

const FILL_COLOR = "rgba(48, 130, 246, 0.85)";

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

  // Generate physics-based displacement + specular maps at mount
  const [thumbMaps, setThumbMaps] = useState<GlassMapResult | null>(null);
  useEffect(() => {
    setThumbMaps(
      generateGlassMaps({
        width: THUMB_W,
        height: THUMB_H,
        radius: THUMB_RX,
        bezelWidth: 16,
        glassThickness: 80,
        refractiveIndex: 1.45,
      })
    );
  }, []);

  const initialValue = value ?? defaultValue ?? min;
  const [internalValue, setInternalValue] = useState(initialValue);
  const valueRef = useRef(initialValue);

  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const thumbBgRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const cloneInnerRef = useRef<HTMLDivElement>(null);
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

  // Update clone inner position to align with the real track.
  // The clone recreates the track scene inside the thumb. We need to offset
  // it so the cloned track/fill lines up pixel-perfectly with the real ones.
  //
  // The thumb element is positioned via GSAP x=thumbX, has marginLeft=-THUMB_OFFSET,
  // and is scaled from center. At scale S, the visible left edge of the thumb
  // (relative to the track container) is:
  //   thumbX - THUMB_OFFSET + THUMB_W * (1-S) / 2
  //
  // Inside the thumb, coordinates are in "unscaled" space. To make the clone's
  // track content appear at the right place, we translate the clone inner by
  // the negative of the thumb's visual offset, divided by the current scale
  // (since the transform is applied pre-scale).
  const updateClone = useCallback((thumbX: number, fillWidth: number) => {
    if (!cloneInnerRef.current) return;
    // thumbX is the left edge offset from track left.
    // marginLeft shifts it by -THUMB_OFFSET.
    // The clone is inside the thumb at full (unscaled) coordinates.
    // We just need: where does the thumb's left edge sit relative to track?
    // thumb left in track = thumbX - THUMB_OFFSET (in unscaled coords).
    // Clone inner left=0 maps to thumb left, so to show track content
    // starting from the right position, translate clone by -(thumbX - THUMB_OFFSET).
    const tx = -(thumbX - THUMB_OFFSET);
    // Vertical: the track center is at TRACK_H/2 from track top.
    // The thumb center is at TRACK_H/2 from track top (CSS top: TRACK_H/2, translateY(-50%)).
    // So the thumb's top edge (unscaled) is at TRACK_H/2 - THUMB_H/2 from track top.
    // Inside the clone, y=0 is the thumb's top. The track top is at:
    //   (TRACK_H/2 - THUMB_H/2) negated = THUMB_H/2 - TRACK_H/2 below clone origin.
    // But we place cloned track at y=(THUMB_H-TRACK_H)/2 inside the clone inner,
    // and the clone inner starts at y=0 of the thumb. We need no vertical offset
    // because the track is already placed at the correct internal position.
    cloneInnerRef.current.style.transform = `translate(${tx}px, 0px)`;
    // fillWidth is in pixels — matches the real fill span width
    cloneInnerRef.current.style.setProperty("--fill-w", `${fillWidth}px`);
  }, []);

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
    updateClone(x, x + halfThumb);
  }, [value, valueToX, halfThumb, updateClone]);

  // Set initial position (no animation)
  useEffect(() => {
    const x = valueToX(valueRef.current);
    if (thumbRef.current) gsap.set(thumbRef.current, { x, scale: SCALE_REST });
    if (fillRef.current) gsap.set(fillRef.current, { width: x + halfThumb });
    if (unfillRef.current) gsap.set(unfillRef.current, { left: x + halfThumb });
    if (labelRef.current) gsap.set(labelRef.current, { x: x + halfThumb });
    if (thumbBgRef.current)
      gsap.set(thumbBgRef.current, { backgroundColor: "rgba(255, 255, 255, 1)" });
    if (cloneRef.current)
      gsap.set(cloneRef.current, { opacity: 0 });
    updateClone(x, x + halfThumb);
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

      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clickX = e.clientX - rect.left - halfThumb;
      const clampedClick = Math.max(0, Math.min(TRAVEL, clickX));
      const clickedValue = xToValue(clampedClick);
      const snappedX = valueToX(clickedValue);

      commitValue(clickedValue);
      updatePositions(snappedX, true);
      updateClone(snappedX, snappedX + halfThumb);

      if (labelRef.current) {
        labelRef.current.textContent =
          formatLabel?.(clickedValue) ?? String(clickedValue);
      }

      dragStartX.current = e.clientX;
      dragStartValue.current = clickedValue;

      // Thumb press: expand to glass mode
      if (thumbRef.current) {
        gsap.to(thumbRef.current, {
          scale: SCALE_GLASS,
          duration: 0.3,
          ease: "back.out(1.4)",
        });
      }
      // Fade thumb bg to transparent, show clone
      if (thumbBgRef.current) {
        gsap.to(thumbBgRef.current, {
          backgroundColor: "rgba(255, 255, 255, 0)",
          duration: 0.25,
          ease: "power2.out",
        });
      }
      if (cloneRef.current) {
        gsap.to(cloneRef.current, {
          opacity: 0.9,
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
    [disabled, xToValue, valueToX, commitValue, updatePositions, formatLabel, halfThumb, updateClone]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPressing.current) return;

      const dx = e.clientX - dragStartX.current;
      const baseX = valueToX(dragStartValue.current);
      const rawX = baseX + dx;
      const clampedX = Math.max(0, Math.min(TRAVEL, rawX));

      if (thumbRef.current) gsap.set(thumbRef.current, { x: clampedX });
      if (fillRef.current) gsap.set(fillRef.current, { width: clampedX + halfThumb });
      if (unfillRef.current) gsap.set(unfillRef.current, { left: clampedX + halfThumb });
      if (labelRef.current) gsap.set(labelRef.current, { x: clampedX + halfThumb });

      const newValue = xToValue(clampedX);
      valueRef.current = newValue;
      updateClone(clampedX, clampedX + halfThumb);

      if (labelRef.current) {
        labelRef.current.textContent =
          formatLabel?.(newValue) ?? String(newValue);
      }
    },
    [valueToX, xToValue, formatLabel, halfThumb, updateClone]
  );

  const handlePointerUp = useCallback(() => {
    if (disabled || !isPressing.current) return;
    isPressing.current = false;

    const snappedValue = valueRef.current;
    const snappedX = valueToX(snappedValue);
    commitValue(snappedValue);
    onChange?.(snappedValue);

    // Animate thumb to snapped position
    if (thumbRef.current) gsap.to(thumbRef.current, { x: snappedX, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (fillRef.current) gsap.to(fillRef.current, { width: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (unfillRef.current) gsap.to(unfillRef.current, { left: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    if (labelRef.current) gsap.to(labelRef.current, { x: snappedX + halfThumb, duration: 0.4, ease: "elastic.out(1, 0.6)" });
    updateClone(snappedX, snappedX + halfThumb);

    // Thumb release: shrink back to rest
    if (thumbRef.current) {
      gsap.to(thumbRef.current, {
        scale: SCALE_REST,
        duration: 0.5,
        ease: "elastic.out(1, 0.7)",
      });
    }
    // Restore thumb bg, hide clone
    if (thumbBgRef.current) {
      gsap.to(thumbBgRef.current, {
        backgroundColor: "rgba(255, 255, 255, 1)",
        duration: 0.35,
        ease: "power2.out",
      });
    }
    if (cloneRef.current) {
      gsap.to(cloneRef.current, {
        opacity: 0,
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
  }, [disabled, commitValue, onChange, valueToX, halfThumb, updateClone]);

  const displayValue = formatLabel?.(internalValue) ?? String(internalValue);

  return (
    <div
      className={`inline-block ${className}`}
      style={{
        transform: visualScale !== 1 ? `scale(${visualScale})` : undefined,
        transformOrigin: "center center",
      }}
    >
      {/* SVG Filter — physics-based displacement + specular */}
      {thumbMaps && (
        <svg
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          aria-hidden="true"
        >
          <defs>
            <filter
              id={thumbFilterId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="0"
                result="blurred_source"
              />
              <feImage
                x="0" y="0"
                width={THUMB_W} height={THUMB_H}
                result="displacement_map"
                href={thumbMaps.displacementMap}
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
              <feColorMatrix
                in="displaced"
                type="saturate"
                values="7"
                result="displaced_saturated"
              />
              {/* Specular highlight layer */}
              <feImage
                x="0" y="0"
                width={THUMB_W} height={THUMB_H}
                result="specular_layer"
                href={thumbMaps.specularMap}
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
        {/* Filled region — blue glass */}
        <span
          ref={fillRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            height: TRACK_H,
            borderRadius: TRACK_R,
            overflow: "hidden",
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

        {/* Unfilled region — frosted glass */}
        <span
          ref={unfillRef}
          className="absolute top-0 pointer-events-none"
          style={{
            right: 0,
            height: TRACK_H,
            borderRadius: TRACK_R,
            overflow: "hidden",
            backgroundColor: "rgba(148, 148, 159, 0.35)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
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

        {/* Thumb */}
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
            boxShadow: "0 3px 14px rgba(0,0,0,0.3)",
          }}
        >
          {/*
            Clone layer: recreates the track scene inside the thumb,
            then applies filter: url(#glassFilter) for real refraction.
            This is the kube.io technique — more reliable than backdrop-filter
            with SVG displacement which only works in Chrome.
          */}
          <div
            ref={cloneRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: "inherit",
              overflow: "hidden",
              zIndex: 1,
              opacity: 0,
              willChange: "opacity",
              filter: `url(#${thumbFilterId})`,
            }}
          >
            <div
              ref={cloneInnerRef}
              className="absolute pointer-events-none"
              style={{
                top: 0,
                left: 0,
                width: TRACK_W,
                height: THUMB_H,
              }}
            >
              {/* Cloned track background (semi-transparent — lets page bg show through) */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: (THUMB_H - TRACK_H) / 2,
                  width: TRACK_W,
                  height: TRACK_H,
                  borderRadius: TRACK_R,
                  backgroundColor: "rgba(0, 0, 0, 0.15)",
                }}
              />
              {/* Cloned fill — width matches real fill in pixels */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: (THUMB_H - TRACK_H) / 2,
                  width: "var(--fill-w, 160px)" as string,
                  height: TRACK_H,
                  borderRadius: TRACK_R,
                  backgroundColor: FILL_COLOR,
                }}
              />
              {/* Cloned unfilled — starts where fill ends */}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: (THUMB_H - TRACK_H) / 2,
                  left: "var(--fill-w, 160px)" as string,
                  height: TRACK_H,
                  borderRadius: TRACK_R,
                  backgroundColor: "rgba(148, 148, 159, 0.35)",
                }}
              />
            </div>
          </div>

          {/* Thumb background (opaque at rest, transparent when pressed) */}
          <div
            ref={thumbBgRef}
            className="absolute inset-0"
            style={{
              borderRadius: THUMB_RX,
              backgroundColor: "rgba(255, 255, 255, 1)",
              zIndex: 2,
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
              zIndex: 3,
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
              zIndex: 3,
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
