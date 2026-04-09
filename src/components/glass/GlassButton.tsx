"use client";

import React, { useRef, useCallback } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface GlassButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const sizeMap = {
  sm: { padding: "10px 20px", fontSize: "13px" },
  md: { padding: "14px 28px", fontSize: "15px" },
  lg: { padding: "18px 36px", fontSize: "17px" },
};

export default function GlassButton({
  children,
  onClick,
  className = "",
  size = "md",
  disabled = false,
}: GlassButtonProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { padding, fontSize } = sizeMap[size];

  const handleMouseEnter = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, { scale: 1.05, duration: 0.3, ease: "back.out(1.7)" });
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.5)" });
  }, [disabled]);

  const handleMouseDown = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, { scale: 0.92, duration: 0.15, ease: "power2.out" });
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    if (disabled || !wrapperRef.current) return;
    gsap.to(wrapperRef.current, { scale: 1.05, duration: 0.4, ease: "elastic.out(1, 0.4)" });
  }, [disabled]);

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
        cornerRadius={100}
        padding={padding}
        style={{ fontSize, fontWeight: 700 }}
        onClick={disabled ? undefined : onClick}
      >
        {children}
      </LiquidGlassWrap>
    </div>
  );
}
