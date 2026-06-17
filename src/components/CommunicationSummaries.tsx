"use client";

import { useEffect, useMemo, useState } from "react";
import { SegmentControl } from "@/components/glass";
import LiquidGlassWrap from "@/components/glass/LiquidGlassWrap";
import type { SummaryChannel, SummaryDate } from "@/lib/summaries";

type Channel = SummaryChannel;

const CHANNELS: Array<{ id: Channel; label: string; tone: string }> = [
  { id: "slack", label: "Slack", tone: "#8b5cf6" },
  { id: "email", label: "Email", tone: "#38bdf8" },
  { id: "whatsapp", label: "WhatsApp", tone: "#22c55e" },
];

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateLabel(date: string) {
  const today = new Date();
  const target = new Date(`${date}T12:00:00`);
  const todayKey = new Intl.DateTimeFormat("en-CA").format(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = new Intl.DateTimeFormat("en-CA").format(yesterday);

  if (date === todayKey) return "Today";
  if (date === yesterdayKey) return "Yesterday";

  return new Intl.DateTimeFormat("en", { weekday: "long" }).format(target);
}

export default function CommunicationSummaries() {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Channel>("slack");
  const [availableDates, setAvailableDates] = useState<SummaryDate[]>([]);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDates() {
      setLoadingDates(true);
      try {
        const response = await fetch("/api/summaries/dates", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;

        if (Array.isArray(data.dates) && data.dates.length > 0) {
          setAvailableDates(data.dates);
          setSelectedDate((current) => data.dates.some((day: SummaryDate) => day.date === current) ? current : data.dates[0].date);
        } else {
          setAvailableDates([]);
          setSelectedDate("");
        }
        setError(data.error || "");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load summary dates");
      } finally {
        if (active) setLoadingDates(false);
      }
    }

    loadDates();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSummary() {
      if (!selectedDate) {
        setSummaryHtml("");
        setLoadingSummary(false);
        return;
      }

      setLoadingSummary(true);
      try {
        const response = await fetch(`/api/summaries/${selectedDate}/${selectedChannel}`, { cache: "no-store" });
        const data = await response.json();
        if (!active) return;

        setSummaryHtml(typeof data.html === "string" ? data.html : "");
        setError(data.error || "");
      } catch (err) {
        if (!active) return;
        setSummaryHtml("");
        setError(err instanceof Error ? err.message : "Could not load summary");
      } finally {
        if (active) setLoadingSummary(false);
      }
    }

    loadSummary();
    return () => {
      active = false;
    };
  }, [selectedDate, selectedChannel]);

  const selectedDay = useMemo(
    () => availableDates.find((day) => day.date === selectedDate) ?? availableDates[0],
    [availableDates, selectedDate]
  );
  const selectedChannelIndex = CHANNELS.findIndex((channel) => channel.id === selectedChannel);
  const channelMeta = CHANNELS[selectedChannelIndex] ?? CHANNELS[0];
  const showInitialLoading = loadingDates && availableDates.length === 0;
  const showSummaryLoading = loadingSummary || (Boolean(selectedDate) && !summaryHtml && !error);

  return (
    <main className="relative z-10 flex-1 px-4 sm:px-8 pb-8 overflow-hidden">
      <div className="h-full grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1 gap-3 sm:gap-4 lg:gap-6 min-h-0">
        <LiquidGlassWrap
          cornerRadius={28}
          padding="0"
          blurAmount={18}
          saturation={150}
          elasticity={0.08}
          className="min-h-0 self-start lg:self-stretch lg:h-full w-full"
          style={{ background: "rgba(0, 0, 0, 0.24)" }}
        >
          <aside className="min-h-0 p-2.5 sm:p-3 lg:p-5 flex flex-col gap-2 lg:gap-4 lg:h-full">
            <div className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Daily archive
              </p>
              <h2 className="text-xl font-black tracking-tight mt-1">Communication</h2>
            </div>

            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden pb-0.5 lg:pb-1 lg:min-h-0">
              {showInitialLoading ? (
                [0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="shrink-0 lg:shrink rounded-xl lg:rounded-2xl px-3 lg:px-4 py-2 lg:py-3 min-w-[108px] lg:min-w-0"
                    style={{
                      background: "rgba(255,255,255,0.045)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="h-3.5 lg:h-4 w-20 rounded-full mb-1.5 lg:mb-2" style={{ background: "rgba(255,255,255,0.16)" }} />
                    <div className="h-2.5 lg:h-3 w-12 rounded-full" style={{ background: "rgba(255,255,255,0.10)" }} />
                  </div>
                ))
              ) : availableDates.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.58)" }}>
                  No summaries found.
                </p>
              ) : availableDates.map((day) => {
                const active = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className="text-left shrink-0 lg:shrink rounded-xl lg:rounded-2xl px-3 lg:px-4 py-2 lg:py-3 transition min-w-[108px] lg:min-w-0"
                    style={{
                      background: active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.045)",
                      border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: active ? "0 12px 30px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.15)" : "none",
                    }}
                  >
                    <div className="flex flex-col gap-0.5 lg:gap-1">
                      <span className="text-xs lg:text-sm font-black">{day.date}</span>
                      <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.56)" }}>
                        {formatDateLabel(day.date)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </LiquidGlassWrap>

        <LiquidGlassWrap
          cornerRadius={32}
          padding="0"
          blurAmount={22}
          saturation={155}
          shadowIntensity={1.4}
          elasticity={0}
          className="summary-panel-glass min-h-0 h-full overflow-hidden"
          style={{ overflow: "hidden", maxHeight: "100%" }}
        >
          <section className="h-full max-h-full min-h-0 overflow-hidden flex flex-col">
            <div className="p-5 sm:p-7 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {selectedDay?.date ? formatLongDate(selectedDay.date) : "Loading Daily Summary"}
                  </p>
                  <h1 className="text-2xl sm:text-4xl font-black tracking-tight mt-1">
                    {channelMeta.label} Summary
                  </h1>
                </div>

                <div className="w-full xl:w-auto">
                  <SegmentControl
                    segments={CHANNELS.map((channel) => channel.label)}
                    activeIndex={selectedChannelIndex}
                    onChange={(index) => setSelectedChannel(CHANNELS[index].id)}
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain p-5 sm:p-7">
              {error && (
                <div className="text-xs mb-4" style={{ color: "rgba(255,210,120,0.85)" }}>
                  {error}
                </div>
              )}

              {showSummaryLoading ? (
                <div
                  className="rounded-[28px] p-5 sm:p-7"
                  style={{
                    background: "rgba(0,0,0,0.24)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 18px rgba(0,0,0,0.28)",
                  }}
                >
                  <div className="h-6 w-56 rounded-full mb-5" style={{ background: "rgba(255,255,255,0.16)" }} />
                  <div className="space-y-3">
                    {[0, 1, 2, 3, 4].map((line) => (
                      <div
                        key={line}
                        className="h-4 rounded-full"
                        style={{
                          width: `${line === 4 ? 62 : 92 - line * 8}%`,
                          background: "rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : summaryHtml ? (
                <article
                  className="summary-html rounded-[28px] p-5 sm:p-7"
                  style={{
                    background: "rgba(0,0,0,0.24)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 18px rgba(0,0,0,0.28)",
                  }}
                  dangerouslySetInnerHTML={{ __html: summaryHtml }}
                />
              ) : (
                <div
                  className="rounded-[28px] p-5 sm:p-7 text-sm"
                  style={{
                    color: "rgba(255,255,255,0.62)",
                    background: "rgba(0,0,0,0.24)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 18px rgba(0,0,0,0.28)",
                  }}
                >
                  {selectedDate ? "No summary available for this channel." : "No summary selected."}
                </div>
              )}
            </div>
          </section>
        </LiquidGlassWrap>
      </div>
    </main>
  );
}
