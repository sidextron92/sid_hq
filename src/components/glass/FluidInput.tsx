"use client";

import React, { useRef, useCallback, useState } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface FluidInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  className?: string;
  icon?: React.ReactNode;
  width?: number;
}

const SearchIcon = () => (
  <svg
    viewBox="0 0 512 512"
    width="20"
    height="20"
    aria-hidden="true"
    fill="currentColor"
    className="shrink-0 opacity-50"
  >
    <path d="M456.69 421.39 362.6 327.3a173.81 173.81 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.81 173.81 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3zM97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8z" />
  </svg>
);

export default function FluidInput({
  placeholder = "Search...",
  value,
  onChange,
  type = "search",
  className = "",
  icon,
  width = 320,
}: FluidInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
    if (!wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 1.02,
      duration: 0.4,
      ease: "elastic.out(1, 0.6)",
    });
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
    if (!wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 1,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
    });
  }, []);

  const handleMouseDown = useCallback(() => {
    if (!wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: 0.96,
      duration: 0.12,
      ease: "power2.out",
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      scale: focused ? 1.02 : 1,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
    });
  }, [focused]);

  const keyIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(() => {
    if (!wrapperRef.current) return;
    if (keyIdleTimer.current) clearTimeout(keyIdleTimer.current);
    keyIdleTimer.current = setTimeout(() => {
      if (!wrapperRef.current) return;
      gsap.to(wrapperRef.current, {
        scaleX: 1.008,
        scaleY: 0.996,
        duration: 0.08,
        ease: "power2.out",
        onComplete: () => {
          if (!wrapperRef.current) return;
          gsap.to(wrapperRef.current, {
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 0.35,
            ease: "elastic.out(1, 0.6)",
          });
        },
      });
    }, 150);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.value);
    },
    [onChange]
  );

  return (
    <div
      ref={wrapperRef}
      className={`inline-block ${className}`}
      style={{ width, willChange: "transform" }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={() => inputRef.current?.focus()}
    >
      <LiquidGlassWrap
        cornerRadius={21}
        padding="0"
        blurAmount={8}
        saturation={140}
        displacementScale={80}
        shadowIntensity={focused ? 0.8 : 0.5}
        elasticity={0.15}
        borderOpacity={focused ? 1 : 0.6}
      >
        <div
          className="flex items-center gap-3"
          style={{
            padding: "0 14px",
            height: 42,
          }}
        >
          {icon || <SearchIcon />}
          <input
            ref={inputRef}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent outline-none border-0 select-text"
            style={{
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              color: "#ffffff",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      </LiquidGlassWrap>
    </div>
  );
}
