"use client";

import React, { useEffect, useRef, useState } from "react";
import { GlassModal } from "@/components/glass";
import { fetchBackgrounds, type PBBackground } from "@/lib/pocketbase";
import gsap from "gsap";

interface BackgroundGalleryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (bg: PBBackground | null) => void;
  currentBackgroundId: string | null;
}

export default function BackgroundGalleryModal({
  open,
  onClose,
  onSelect,
  currentBackgroundId,
}: BackgroundGalleryModalProps) {
  const [backgrounds, setBackgrounds] = useState<PBBackground[]>([]);
  const [loading, setLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchBackgrounds()
      .then((bgs) => {
        if (!cancelled) setBackgrounds(bgs);
      })
      .catch((err) => console.error("Failed to fetch backgrounds:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Stagger-animate grid items when backgrounds load
  useEffect(() => {
    if (!open || loading || !gridRef.current) return;
    const items = gridRef.current.querySelectorAll<HTMLElement>(".bg-gallery-item");
    if (items.length === 0) return;
    gsap.fromTo(
      items,
      { opacity: 0, y: 12, scale: 0.92 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.05,
      }
    );
  }, [open, loading, backgrounds]);

  const isSelected = (id: string | null) =>
    id === null ? currentBackgroundId === null : currentBackgroundId === id;

  return (
    <GlassModal open={open} onClose={onClose} width={520}>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text-main, #fcfcfd)" }}
          >
            Background Gallery
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Choose a background for your workspace
          </p>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p
              className="text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Loading backgrounds...
            </p>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
          >
            {/* Default option */}
            <button
              className="bg-gallery-item rounded-xl overflow-hidden cursor-pointer text-left"
              style={{
                border: isSelected(null)
                  ? "2px solid rgba(99, 102, 241, 0.8)"
                  : "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                opacity: 0,
              }}
              onClick={() => onSelect(null)}
              onMouseEnter={(e) => {
                if (!isSelected(null))
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.3)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected(null))
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.12)";
              }}
            >
              <div className="relative aspect-video">
                <video
                  className="w-full h-full object-cover"
                  src="/background.webm"
                  muted
                  playsInline
                  autoPlay
                  loop
                />
                {isSelected(null) && <SelectedBadge />}
              </div>
              <div
                className="px-2 py-1.5 text-xs font-bold truncate"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                Default
              </div>
            </button>

            {/* Background options */}
            {backgrounds.map((bg) => (
              <button
                key={bg.id}
                className="bg-gallery-item rounded-xl overflow-hidden cursor-pointer text-left"
                style={{
                  border: isSelected(bg.id)
                    ? "2px solid rgba(99, 102, 241, 0.8)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  opacity: 0,
                }}
                onClick={() => onSelect(bg)}
                onMouseEnter={(e) => {
                  if (!isSelected(bg.id))
                    e.currentTarget.style.border =
                      "1px solid rgba(255,255,255,0.3)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected(bg.id))
                    e.currentTarget.style.border =
                      "1px solid rgba(255,255,255,0.12)";
                }}
              >
                <div className="relative aspect-video">
                  <img
                    className="w-full h-full object-cover"
                    src={bg.thumbnailUrl}
                    alt={bg.name}
                    loading="lazy"
                  />
                  {isSelected(bg.id) && <SelectedBadge />}
                </div>
                <div
                  className="px-2 py-1.5 text-xs font-bold truncate"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  {bg.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </GlassModal>
  );
}

function SelectedBadge() {
  return (
    <div
      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
      style={{
        background: "rgba(99, 102, 241, 0.9)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}
