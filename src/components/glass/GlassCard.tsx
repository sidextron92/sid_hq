"use client";

import React, { useRef, useCallback } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  draggable?: boolean;
  cornerRadius?: number;
  padding?: string;
  style?: React.CSSProperties;
}

export default function GlassCard({
  children,
  className = "",
  draggable = false,
  cornerRadius = 24,
  padding = "24px 28px",
  style,
}: GlassCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ isDragging: false, lastX: 0, lastY: 0 });

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
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragState.current.isDragging || !wrapperRef.current) return;
    dragState.current.isDragging = false;
    gsap.to(wrapperRef.current, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" });
  }, []);

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
      >
        {children}
      </LiquidGlassWrap>
    </div>
  );
}
