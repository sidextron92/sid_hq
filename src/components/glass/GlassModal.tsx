"use client";

import React, { useRef, useEffect, useCallback } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface GlassModalProps {
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  className?: string;
  width?: number;
}

export default function GlassModal({
  children,
  open,
  onClose,
  className = "",
  width = 420,
}: GlassModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);

  const animateOpen = useCallback(() => {
    if (!backdropRef.current || !panelRef.current) return;
    isAnimating.current = true;

    gsap.to(backdropRef.current, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out",
    });

    gsap.fromTo(
      panelRef.current,
      { scale: 0.85, y: 20, opacity: 0 },
      {
        scale: 1,
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "elastic.out(1, 0.6)",
        onComplete: () => {
          isAnimating.current = false;
        },
      }
    );
  }, []);

  const animateClose = useCallback(() => {
    if (!backdropRef.current || !panelRef.current || isAnimating.current) return;
    isAnimating.current = true;

    gsap.to(panelRef.current, {
      scale: 0.85,
      y: 20,
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
    });

    gsap.to(backdropRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        isAnimating.current = false;
        onClose();
      },
    });
  }, [onClose]);

  useEffect(() => {
    if (open) {
      animateOpen();
    }
  }, [open, animateOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, animateClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(4px) saturate(120%)",
          WebkitBackdropFilter: "blur(4px) saturate(120%)",
          opacity: 0,
        }}
        onClick={animateClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative z-10 ${className}`}
        style={{
          width,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 64px)",
          opacity: 0,
          willChange: "transform, opacity",
        }}
      >
        <LiquidGlassWrap
          cornerRadius={24}
          padding="0"
          blurAmount={25}
          displacementScale={60}
          saturation={160}
          shadowIntensity={1.8}
          elasticity={0}
        >
          {/* Close button */}
          <button
            onClick={animateClose}
            className="absolute top-4 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "rgba(255, 255, 255, 0.6)",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="p-8 overflow-y-auto" style={{ maxHeight: "calc(100vh - 96px)" }}>
            {children}
          </div>
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
