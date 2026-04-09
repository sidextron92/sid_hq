"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import LiquidGlassWrap from "./LiquidGlassWrap";
import gsap from "gsap";

interface DropdownOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface GlassDropdownProps {
  options: DropdownOption[];
  value?: string;
  placeholder?: string;
  onChange?: (option: DropdownOption) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  width?: number;
}

const sizeMap = {
  sm: { padding: "10px 16px", fontSize: "13px", iconSize: 16 },
  md: { padding: "14px 20px", fontSize: "15px", iconSize: 18 },
  lg: { padding: "18px 24px", fontSize: "17px", iconSize: 20 },
};

export default function GlassDropdown({
  options,
  value,
  placeholder = "Select...",
  onChange,
  className = "",
  size = "md",
  disabled = false,
  width = 240,
}: GlassDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { padding, fontSize, iconSize } = sizeMap[size];

  const selectedOption = options.find((o) => o.id === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
      closeMenu();
    };
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);

    requestAnimationFrame(() => {
      if (!menuRef.current || !chevronRef.current) return;

      gsap.fromTo(
        menuRef.current,
        { scale: 0.85, y: -4, opacity: 0 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          pointerEvents: "auto",
          duration: 0.4,
          ease: "elastic.out(1, 0.6)",
        }
      );

      gsap.to(chevronRef.current, {
        rotation: 180,
        duration: 0.3,
        ease: "back.out(1.7)",
      });

      // Stagger items
      const items = itemRefs.current.filter(Boolean);
      gsap.fromTo(
        items,
        { opacity: 0, x: -8 },
        {
          opacity: 1,
          x: 0,
          duration: 0.3,
          ease: "power2.out",
          stagger: 0.035,
        }
      );
    });
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);

    if (!menuRef.current || !chevronRef.current) return;

    gsap.to(menuRef.current, {
      scale: 0.85,
      y: -4,
      opacity: 0,
      pointerEvents: "none",
      duration: 0.2,
      ease: "power2.in",
    });

    gsap.to(chevronRef.current, {
      rotation: 0,
      duration: 0.3,
      ease: "back.out(1.7)",
    });
  }, []);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      if (option.disabled) return;
      onChange?.(option);
      closeMenu();

      // Scale punch on trigger
      if (triggerRef.current) {
        gsap.fromTo(
          triggerRef.current,
          { scale: 0.96 },
          { scale: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" }
        );
      }
    },
    [onChange, closeMenu]
  );

  const handleToggle = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [isOpen, openMenu, closeMenu]);

  // GSAP hover/press on trigger
  const handleMouseEnter = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    gsap.to(triggerRef.current, {
      scale: 1.03,
      duration: 0.3,
      ease: "back.out(1.7)",
    });
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    gsap.to(triggerRef.current, {
      scale: 1,
      duration: 0.4,
      ease: "elastic.out(1, 0.5)",
    });
  }, [disabled]);

  const handleMouseDown = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    gsap.to(triggerRef.current, {
      scale: 0.96,
      duration: 0.15,
      ease: "power2.out",
    });
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    if (disabled || !triggerRef.current) return;
    gsap.to(triggerRef.current, {
      scale: 1.03,
      duration: 0.4,
      ease: "elastic.out(1, 0.4)",
    });
  }, [disabled]);

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width }}
    >
      {/* Trigger */}
      <div
        ref={triggerRef}
        style={{ willChange: "transform" }}
        className={disabled ? "opacity-40 pointer-events-none" : ""}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <LiquidGlassWrap
          cornerRadius={100}
          padding={padding}
          blurAmount={8}
          displacementScale={80}
          elasticity={0.15}
          onClick={handleToggle}
        >
          <div
            className="flex items-center justify-between gap-3"
            style={{ fontSize, fontWeight: 700 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {selectedOption?.icon && (
                <span className="flex-shrink-0 opacity-80">
                  {selectedOption.icon}
                </span>
              )}
              <span
                className="truncate"
                style={{
                  color: selectedOption
                    ? "var(--text-main, #fcfcfd)"
                    : "var(--text-muted, #8a8a98)",
                }}
              >
                {selectedOption?.label ?? placeholder}
              </span>
            </div>

            {/* Chevron */}
            <svg
              ref={chevronRef}
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0 opacity-50"
              style={{ willChange: "transform" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </LiquidGlassWrap>
      </div>

      {/* Dropdown menu */}
      <div
        ref={menuRef}
        className="absolute z-50 left-0 right-0 mt-2"
        style={{
          opacity: 0,
          transform: "scale(0.85) translateY(-4px)",
          willChange: "transform, opacity",
          pointerEvents: "none",
        }}
      >
        <LiquidGlassWrap
          cornerRadius={20}
          padding="6px"
          blurAmount={80}
          displacementScale={60}
          saturation={160}
          shadowIntensity={1.5}
          elasticity={0}
          tint="rgba(0, 0, 0, 0.8)"
        >
          <div className="flex flex-col gap-0.5">
            {options.map((option, i) => (
              <div
                key={option.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl select-none ${
                  option.disabled
                    ? "opacity-30 cursor-not-allowed"
                    : "cursor-pointer"
                }`}
                style={{
                  background:
                    option.id === value
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    option.id === value
                      ? "inset 0 1px 2px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.2)"
                      : "inset 0 2px 6px rgba(0,0,0,0.3)",
                  fontSize,
                }}
                onMouseEnter={(e) => {
                  if (option.disabled) return;
                  const el = e.currentTarget;
                  el.style.background = "rgba(255,255,255,0.08)";
                  gsap.to(el, {
                    x: 4,
                    duration: 0.25,
                    ease: "power2.out",
                  });
                }}
                onMouseLeave={(e) => {
                  if (option.disabled) return;
                  const el = e.currentTarget;
                  el.style.background =
                    option.id === value
                      ? "rgba(255,255,255,0.1)"
                      : "transparent";
                  gsap.to(el, {
                    x: 0,
                    duration: 0.3,
                    ease: "elastic.out(1, 0.5)",
                  });
                }}
                onMouseDown={(e) => {
                  if (option.disabled) return;
                  gsap.to(e.currentTarget, {
                    scale: 0.97,
                    duration: 0.1,
                    ease: "power2.out",
                  });
                }}
                onMouseUp={(e) => {
                  if (option.disabled) return;
                  gsap.to(e.currentTarget, {
                    scale: 1,
                    duration: 0.3,
                    ease: "elastic.out(1, 0.4)",
                  });
                }}
                onClick={() => handleSelect(option)}
              >
                {option.icon && (
                  <span
                    className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                    style={{
                      border: "1.5px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.05)",
                    }}
                  >
                    {option.icon}
                  </span>
                )}
                <span
                  className="font-bold truncate"
                  style={{ color: "var(--text-main, #fcfcfd)" }}
                >
                  {option.label}
                </span>

                {/* Check mark for selected */}
                {option.id === value && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto flex-shrink-0 opacity-60"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
