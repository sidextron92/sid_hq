import { LiquidGlassWrap } from "@/components/glass";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Ambient orbs */}
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

      <div className="relative z-10 text-center">
        <LiquidGlassWrap cornerRadius={32} padding="48px 64px">
          <h1 className="text-5xl font-black tracking-tight text-foreground mb-3">
            Control Centre
          </h1>
          <p className="text-xl text-muted font-semibold">
            Coming Soon
          </p>
        </LiquidGlassWrap>
      </div>
    </div>
  );
}
