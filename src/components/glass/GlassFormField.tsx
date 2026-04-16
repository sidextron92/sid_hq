"use client";

import React, { useRef, useCallback, useState } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface GlassFormFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function GlassFormField({
  label,
  placeholder = "",
  value,
  onChange,
  onKeyDown,
  type = "text",
  className = "",
  autoFocus = false,
}: GlassFormFieldProps) {
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
      scale: 0.97,
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
        scaleX: 1.006,
        scaleY: 0.997,
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
    <div className={className}>
      {label && (
        <label
          className="block text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
        >
          {label}
        </label>
      )}
      <div
        ref={wrapperRef}
        style={{ willChange: "transform" }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={() => inputRef.current?.focus()}
      >
        <LiquidGlassWrap
          cornerRadius={16}
          padding="0"
          blurAmount={8}
          displacementScale={80}
          shadowIntensity={focused ? 0.8 : 0.5}
          elasticity={0.15}
          borderOpacity={focused ? 1 : 0.6}
        >
          <input
            ref={inputRef}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              handleKeyDown();
              onKeyDown?.(e);
            }}
            autoFocus={autoFocus}
            className="w-full bg-transparent outline-none border-0 select-text"
            style={{
              fontSize: 15,
              lineHeight: 1,
              padding: "14px 18px",
              color: "#ffffff",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          />
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
