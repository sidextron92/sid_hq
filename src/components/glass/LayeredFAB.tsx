"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface FABAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

interface LayeredFABProps {
  actions: FABAction[];
  className?: string;
}

export default function LayeredFAB({
  actions,
  className = "",
}: LayeredFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const isPressing = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastMoveX = useRef(0);
  const lastMoveTime = useRef(0);
  const velocityRef = useRef(0);

  // no-op: capsule starts at natural scale
  useEffect(() => {}, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isPressing.current = true;
    didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastMoveX.current = e.clientX;
    lastMoveTime.current = Date.now();
    velocityRef.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (!capsuleRef.current) return;

    // Press: slight scale up
    gsap.to(capsuleRef.current, {
      scale: 1.05,
      duration: 0.4,
      ease: "elastic.out(1, 0.6)",
    });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPressing.current || !capsuleRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      didDrag.current = true;
    }
    if (!didDrag.current) return;

    const now = Date.now();
    const dt = now - lastMoveTime.current;
    if (dt > 0) {
      velocityRef.current = ((e.clientX - lastMoveX.current) / dt) * 1000;
    }
    lastMoveX.current = e.clientX;
    lastMoveTime.current = now;

    const moveX = e.clientX - dragStart.current.x;
    const moveY = e.clientY - dragStart.current.y;
    gsap.set(capsuleRef.current, {
      x: `+=${moveX}`,
      y: `+=${moveY}`,
    });

    // Velocity-based horizontal squish
    const velSquish = Math.max(0.8, 1 - Math.abs(velocityRef.current) / 4000);
    gsap.set(capsuleRef.current, { scaleX: velSquish });

    dragStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isPressing.current) return;
    isPressing.current = false;

    if (!capsuleRef.current) return;

    // Restore shape
    gsap.to(capsuleRef.current, {
      scaleX: 1,
      scale: 1,
      duration: 0.5,
      ease: "elastic.out(1, 0.6)",
    });

    if (!didDrag.current) {
      toggleMenu();
    }

    velocityRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleMenu = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);

    if (!menuRef.current || !capsuleRef.current || !iconRef.current) return;

    if (next) {
      gsap.fromTo(
        menuRef.current,
        { scale: 0.4, y: 10, opacity: 0 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          pointerEvents: "auto",
          duration: 0.5,
          ease: "elastic.out(1, 0.6)",
        }
      );

      gsap.to(iconRef.current, {
        rotation: 45,
        duration: 0.3,
        ease: "back.out(1.7)",
      });
    } else {
      gsap.to(menuRef.current, {
        scale: 0.4,
        y: 10,
        opacity: 0,
        pointerEvents: "none",
        duration: 0.25,
        ease: "power2.in",
      });

      gsap.to(iconRef.current, {
        rotation: 0,
        duration: 0.3,
        ease: "back.out(1.7)",
      });
    }
  }, [isOpen]);

  const handleActionClick = useCallback((action: FABAction) => {
    action.onClick?.();
    setIsOpen(false);

    if (!menuRef.current || !capsuleRef.current || !iconRef.current) return;

    gsap.to(capsuleRef.current, {
      scaleY: 0.85,
      duration: 0.4,
      ease: "elastic.out(1, 0.6)",
    });

    gsap.to(menuRef.current, {
      scale: 0.4,
      y: 10,
      opacity: 0,
      pointerEvents: "none",
      duration: 0.25,
      ease: "power2.in",
    });

    gsap.to(iconRef.current, {
      rotation: 0,
      duration: 0.3,
      ease: "back.out(1.7)",
    });
  }, []);

  return (
    <div
      ref={capsuleRef}
      className={`fixed bottom-8 right-8 z-50 cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{
        touchAction: "none",
        willChange: "transform",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Glass capsule body — uses LiquidGlassWrap for blur, refraction, hover glow, elasticity */}
      <LiquidGlassWrap
        cornerRadius={65}
        padding="0"
        blurAmount={5}
        displacementScale={100}
        saturation={140}
        elasticity={0.3}
        shadowIntensity={1.2}
        borderOpacity={1}
        style={{ width: 160, height: 120 }}
      >
        {/* + icon (rotates to x when open) */}
        <div
          ref={iconRef}
          className="flex items-center justify-center"
          style={{
            width: 160,
            height: 120,
            willChange: "transform",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </div>
      </LiquidGlassWrap>

      {/* Expandable menu (above the capsule) */}
      <div
        ref={menuRef}
        className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2"
        style={{
          opacity: 0,
          transform: "scale(0.4) translateY(10px)",
          willChange: "transform, opacity",
          pointerEvents: "none",
          minWidth: 180,
        }}
      >
        <LiquidGlassWrap
          cornerRadius={20}
          padding="8px"
          blurAmount={12}
          displacementScale={60}
          saturation={140}
          shadowIntensity={1.5}
        >
          <div className="flex flex-col gap-1">
            {actions.map((action) => (
              <div
                key={action.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                style={{ transition: "background 0.15s" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "rgba(255,255,255,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }}
                onClick={() => handleActionClick(action)}
              >
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{
                    border: "1.5px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  {action.icon}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: "var(--text-main)" }}
                >
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
