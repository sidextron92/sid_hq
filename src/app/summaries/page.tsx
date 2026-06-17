"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CommunicationSummaries from "@/components/CommunicationSummaries";
import { useAuth } from "@/context/AuthContext";

export default function SummariesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="h-screen bg-background relative overflow-hidden flex flex-col">
      <video
        ref={videoRef}
        className="absolute inset-0 z-0 w-full h-full object-cover"
        src="/background.webm"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />

      <div className="absolute inset-0 z-0" style={{ background: "rgba(0, 0, 0, 0.16)" }} />

      <header className="relative z-30 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-3xl font-bold tracking-tight text-foreground">
              Control Centre
            </h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "rgba(255,255,255,0.58)" }}>
              Daily summaries across Slack, Email, and WhatsApp
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition hover:scale-105 active:scale-95"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(5px) saturate(140%)",
                WebkitBackdropFilter: "blur(5px) saturate(140%)",
                textShadow: "0px 2px 12px rgba(0,0,0,0.4)",
              }}
            >
              Tasks
            </Link>
            <span
              className="inline-flex items-center rounded-full px-5 py-2.5 text-[13px] font-bold text-white opacity-45"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35), inset 0 2px 4px rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(5px) saturate(140%)",
                WebkitBackdropFilter: "blur(5px) saturate(140%)",
                textShadow: "0px 2px 12px rgba(0,0,0,0.4)",
              }}
            >
              Summaries
            </span>
          </div>
        </div>
      </header>

      <CommunicationSummaries />
    </div>
  );
}
