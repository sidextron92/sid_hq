"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import gsap from "gsap";

interface SegmentControlProps {
  segments: string[];
  activeIndex?: number;
  onChange?: (index: number, label: string) => void;
  className?: string;
}

export default function SegmentControl({
  segments,
  activeIndex = 0,
  onChange,
  className = "",
}: SegmentControlProps) {
  const [active, setActive] = useState(activeIndex);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    setActive(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (!indicatorRef.current || !containerRef.current) return;
    const segEl = segmentRefs.current[active];
    if (!segEl) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const segRect = segEl.getBoundingClientRect();
    const targetX = segRect.left - containerRect.left;

    gsap.to(indicatorRef.current, {
      x: targetX,
      width: segRect.width,
      duration: 0.5,
      ease: "elastic.out(1, 0.65)",
    });

    gsap.fromTo(
      indicatorRef.current,
      { scaleX: 1.15 },
      { scaleX: 1, duration: 0.4, ease: "elastic.out(1, 0.5)" }
    );
  }, [active]);

  const handleSelect = useCallback(
    (index: number) => {
      setActive(index);
      onChange?.(index, segments[index]);
    },
    [onChange, segments]
  );

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center rounded-full p-[5px] ${className}`}
      style={{
        background: "rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      {/* Sliding indicator */}
      <div
        ref={indicatorRef}
        className="absolute z-0 rounded-full"
        style={{
          top: 5,
          left: 0,
          height: "calc(100% - 10px)",
          willChange: "transform",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow:
            "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
        }}
      />

      {segments.map((label, index) => (
        <div
          key={label}
          ref={(el) => {
            if (el) segmentRefs.current[index] = el;
          }}
          className="relative z-10 px-3 sm:px-6 py-2.5 cursor-pointer select-none text-sm font-bold flex-1"
          style={{
            opacity: active === index ? 1 : 0.5,
            transition: "opacity 0.2s",
            textAlign: "center",
          }}
          onClick={() => handleSelect(index)}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
