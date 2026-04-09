"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import gsap from "gsap";

interface DockItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface DragDockProps {
  items: DockItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  direction?: "horizontal" | "vertical";
}

export default function DragDock({
  items,
  activeId,
  onSelect,
  className = "",
  direction = "horizontal",
}: DragDockProps) {
  const [active, setActive] = useState(activeId || items[0]?.id);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (activeId) setActive(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!indicatorRef.current || !containerRef.current) return;
    const activeEl = itemRefs.current.get(active);
    if (!activeEl) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    const isH = direction === "horizontal";
    const targetPos = isH
      ? activeRect.left - containerRect.left
      : activeRect.top - containerRect.top;

    gsap.to(indicatorRef.current, {
      [isH ? "x" : "y"]: targetPos,
      [isH ? "width" : "height"]: isH ? activeRect.width : activeRect.height,
      duration: 0.5,
      ease: "elastic.out(1, 0.7)",
    });

    // Rubber-band stretch
    gsap.fromTo(
      indicatorRef.current,
      { [isH ? "scaleX" : "scaleY"]: 1.12 },
      {
        [isH ? "scaleX" : "scaleY"]: 1,
        duration: 0.4,
        ease: "elastic.out(1, 0.5)",
      }
    );
  }, [active, direction]);

  const handleSelect = useCallback(
    (id: string) => {
      setActive(id);
      onSelect?.(id);
    },
    [onSelect]
  );

  const isH = direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${isH ? "flex-row" : "flex-col"} items-center rounded-[20px] p-[6px] ${className}`}
      style={{
        background: "rgba(0, 0, 0, 0.35)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      {/* Sliding glass indicator */}
      <div
        ref={indicatorRef}
        className="absolute z-0 rounded-[16px]"
        style={{
          [isH ? "top" : "left"]: 6,
          [isH ? "left" : "top"]: 0,
          [isH ? "height" : "width"]: "calc(100% - 12px)",
          willChange: "transform",
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow:
            "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.15)",
          backdropFilter: "blur(12px) saturate(140%)",
          WebkitBackdropFilter: "blur(12px) saturate(140%)",
        }}
      />

      {items.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            if (el) itemRefs.current.set(item.id, el);
          }}
          className={`relative z-10 flex ${isH ? "flex-col" : "flex-row"} items-center gap-1 px-5 py-3 cursor-pointer select-none`}
          style={{
            opacity: active === item.id ? 1 : 0.5,
            transition: "opacity 0.2s",
            minWidth: isH ? 70 : undefined,
          }}
          onClick={() => handleSelect(item.id)}
        >
          <span
            style={{
              transform: active === item.id ? "scale(1.15) translateY(-1px)" : "scale(1)",
              filter: active === item.id ? "drop-shadow(0 0 6px rgba(255,255,255,0.35))" : "none",
              transition: "all 0.3s",
            }}
          >
            {item.icon}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
