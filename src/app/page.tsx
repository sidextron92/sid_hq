"use client";

import { useState } from "react";
import {
  GlassCard,
  GlassButton,
  TactileSwitch,
  DragDock,
  SegmentControl,
  FluidInput,
  LayeredFAB,
} from "@/components/glass";

const dockItems = [
  {
    id: "home",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Stats",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const fabActions = [
  {
    id: "add-task",
    label: "New Task",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    id: "note",
    label: "Quick Note",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    id: "timer",
    label: "Start Timer",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

type BgMode = "default" | "wallpaper";

export default function Home() {
  const [switchOn, setSwitchOn] = useState(false);
  const [segment, setSegment] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [bgMode, setBgMode] = useState<BgMode>("default");

  return (
    <>
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Wallpaper background */}
      {bgMode === "wallpaper" && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: "url('/wallpaper.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}

      {/* Default background: grid + orbs */}
      {bgMode === "default" && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.08) 59px, rgba(255,255,255,0.08) 60px),
              repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.08) 59px, rgba(255,255,255,0.08) 60px)
            `,
          }} />
          <div
            className="ambient-orb"
            style={{
              width: 400, height: 400, top: -100, left: -100,
              background: "radial-gradient(circle, #6366f1, transparent)",
            }}
          />
          <div
            className="ambient-orb"
            style={{
              width: 350, height: 350, bottom: 100, right: -50,
              background: "radial-gradient(circle, #ec4899, transparent)",
            }}
          />
          <div
            className="ambient-orb"
            style={{
              width: 300, height: 300, top: "40%", left: "50%",
              background: "radial-gradient(circle, #14b8a6, transparent)",
              opacity: 0.25,
            }}
          />
        </>
      )}

      {/* Header */}
      <header className="relative z-10 px-8 pt-12 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Control Centre
          </h1>
          <p className="text-muted mt-1 text-lg font-semibold">
            Component Gallery
          </p>
        </div>
        <SegmentControl
          segments={["Grid", "Wallpaper"]}
          activeIndex={bgMode === "default" ? 0 : 1}
          onChange={(i) => setBgMode(i === 0 ? "default" : "wallpaper")}
        />
      </header>

      {/* Component grid */}
      <main className="relative z-10 px-8 pb-24 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* GlassCard */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              01 — Glass Card
            </h2>
            <GlassCard draggable>
              <h3 className="text-lg font-black mb-1">Draggable Card</h3>
              <p className="text-sm text-muted">
                Grab and drag me. I&apos;ll stretch with velocity and snap back with spring physics.
              </p>
            </GlassCard>
          </section>

          {/* GlassCard static */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              02 — Static Card
            </h2>
            <GlassCard cornerRadius={16}>
              <h3 className="text-lg font-black mb-1">Info Panel</h3>
              <p className="text-sm text-muted">
                A non-draggable glass card for content display. The liquid refraction responds to mouse movement.
              </p>
            </GlassCard>
          </section>

          {/* Buttons */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              03 — Glass Buttons
            </h2>
            <div className="flex flex-wrap gap-3 items-center">
              <GlassButton size="sm">Small</GlassButton>
              <GlassButton>Primary</GlassButton>
              <GlassButton size="lg">
                Ghost
              </GlassButton>
              <GlassButton disabled>Disabled</GlassButton>
            </div>
          </section>

          {/* Tactile Switch */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              04 — Tactile Switch
            </h2>
            <div className="flex items-center gap-4">
              <TactileSwitch checked={switchOn} onChange={setSwitchOn} />
              <span className="text-sm font-bold text-muted">
                {switchOn ? "Active" : "Inactive"}
              </span>
            </div>
          </section>

          {/* Segment Control */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              05 — Segment Control
            </h2>
            <SegmentControl
              segments={["Board", "List", "Timeline"]}
              activeIndex={segment}
              onChange={(i) => setSegment(i)}
            />
          </section>

          {/* Fluid Input */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              06 — Fluid Input
            </h2>
            <FluidInput
              placeholder="Search tasks..."
              value={inputValue}
              onChange={setInputValue}
            />
          </section>

          {/* Drag Dock */}
          <section className="md:col-span-2">
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              07 — Drag Dock
            </h2>
            <DragDock items={dockItems} />
          </section>

          {/* Layered FAB note */}
          <section>
            <h2 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">
              08 — Layered FAB
            </h2>
            <p className="text-sm text-muted">
              Fixed bottom-right. Drag it around, tap to open menu.
            </p>
          </section>
        </div>
      </main>
    </div>

    {/* FAB — rendered outside the overflow-hidden container */}
    <LayeredFAB actions={fabActions} />
    </>
  );
}
