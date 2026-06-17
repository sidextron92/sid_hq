"use client";

import { useEffect, useMemo, useState } from "react";
import { SegmentControl } from "@/components/glass";
import LiquidGlassWrap from "@/components/glass/LiquidGlassWrap";
import type { SummaryChannel, SummaryDate } from "@/lib/summaries";

type Channel = SummaryChannel;

type SummaryDay = {
  date: string;
  label: string;
  channels: Record<Channel, string>;
};

const CHANNELS: Array<{ id: Channel; label: string; tone: string }> = [
  { id: "slack", label: "Slack", tone: "#8b5cf6" },
  { id: "email", label: "Email", tone: "#38bdf8" },
  { id: "whatsapp", label: "WhatsApp", tone: "#22c55e" },
];

const DUMMY_SUMMARIES: SummaryDay[] = [
  {
    date: "2026-06-17",
    label: "Today",
    channels: {
      slack: `
        <h2>Slack Summary</h2>
        <p><strong>Overall:</strong> Product and infra conversations were active, with two decisions and three follow-ups.</p>
        <h3>Highlights</h3>
        <ul>
          <li>Design approved the compact mobile task cards for the Control Centre board.</li>
          <li>Infra confirmed the nightly job window can move to 02:30 without affecting imports.</li>
          <li>Ops asked for clearer ownership on recurring task failures.</li>
        </ul>
        <h3>Action Items</h3>
        <ol>
          <li>Send the final mobile screenshots to design.</li>
          <li>Confirm the cron update with the infra channel.</li>
          <li>Create a bug ticket for duplicate recurring comments.</li>
        </ol>
      `,
      email: `
        <h2>Email Summary</h2>
        <p><strong>Inbox load:</strong> 18 relevant messages, 5 need replies, 2 can be archived.</p>
        <h3>Needs Reply</h3>
        <ul>
          <li>Vendor contract renewal asks for confirmation by Friday.</li>
          <li>Finance needs the May usage notes for reconciliation.</li>
          <li>Hiring follow-up asks for interview availability next week.</li>
        </ul>
        <h3>Low Priority</h3>
        <p>Newsletter updates, product release notes, and two automated billing receipts.</p>
      `,
      whatsapp: `
        <h2>WhatsApp Summary</h2>
        <p><strong>Personal:</strong> Mostly coordination messages. No urgent issues.</p>
        <h3>Notable Threads</h3>
        <ul>
          <li>Family dinner moved from Saturday evening to Sunday lunch.</li>
          <li>Apartment group reported water maintenance from 10:00 to 12:00 tomorrow.</li>
          <li>Travel group shared tentative dates for the July trip.</li>
        </ul>
      `,
    },
  },
  {
    date: "2026-06-16",
    label: "Yesterday",
    channels: {
      slack: `
        <h2>Slack Summary</h2>
        <p><strong>Overall:</strong> Quiet day. Most activity centered around QA feedback.</p>
        <ul>
          <li>QA found a task modal keyboard regression on mobile Safari.</li>
          <li>Design shared background gallery references.</li>
          <li>Engineering agreed to keep the summaries feature read-only for v1.</li>
        </ul>
      `,
      email: `
        <h2>Email Summary</h2>
        <p><strong>Inbox load:</strong> 11 relevant messages, 2 need replies.</p>
        <ul>
          <li>Account statement arrived from the bank.</li>
          <li>Calendar invite changed for the weekly planning call.</li>
        </ul>
      `,
      whatsapp: `
        <h2>WhatsApp Summary</h2>
        <p><strong>Personal:</strong> Two logistics updates and one reminder.</p>
        <ul>
          <li>Package pickup reminder for the evening.</li>
          <li>Gym group shifted tomorrow's session by 30 minutes.</li>
        </ul>
      `,
    },
  },
  {
    date: "2026-06-15",
    label: "Monday",
    channels: {
      slack: `
        <h2>Slack Summary</h2>
        <p><strong>Overall:</strong> Planning-heavy day with several roadmap notes.</p>
        <ul>
          <li>Team aligned on shipping summaries as a separate route first.</li>
          <li>Backend suggested keeping remote server credentials out of client code.</li>
          <li>Design requested a persistent date list on desktop.</li>
        </ul>
      `,
      email: `
        <h2>Email Summary</h2>
        <p><strong>Inbox load:</strong> 23 relevant messages, 7 need replies.</p>
        <ul>
          <li>Three project updates need acknowledgement.</li>
          <li>One invoice requires approval.</li>
          <li>Two newsletters had useful AI workflow links.</li>
        </ul>
      `,
      whatsapp: `
        <h2>WhatsApp Summary</h2>
        <p><strong>Personal:</strong> Mostly social planning.</p>
        <ul>
          <li>Friends confirmed Friday dinner location.</li>
          <li>Building group discussed parking sticker renewal.</li>
        </ul>
      `,
    },
  },
];

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function CommunicationSummaries() {
  const [selectedDate, setSelectedDate] = useState(DUMMY_SUMMARIES[0].date);
  const [selectedChannel, setSelectedChannel] = useState<Channel>("slack");
  const [availableDates, setAvailableDates] = useState<SummaryDate[]>(
    DUMMY_SUMMARIES.map((day) => ({ date: day.date, channels: ["slack", "email", "whatsapp"] }))
  );
  const [summaryHtml, setSummaryHtml] = useState(DUMMY_SUMMARIES[0].channels.slack);
  const [source, setSource] = useState<"remote" | "dummy">("dummy");
  const [loadingDates, setLoadingDates] = useState(false);
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
        }
        setSource(data.source === "remote" ? "remote" : "dummy");
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
      setLoadingSummary(true);
      try {
        const response = await fetch(`/api/summaries/${selectedDate}/${selectedChannel}`, { cache: "no-store" });
        const data = await response.json();
        if (!active) return;

        const fallbackDay = DUMMY_SUMMARIES.find((day) => day.date === selectedDate) ?? DUMMY_SUMMARIES[0];
        setSummaryHtml(typeof data.html === "string" ? data.html : fallbackDay.channels[selectedChannel]);
        setSource(data.source === "remote" ? "remote" : "dummy");
        setError(data.error || "");
      } catch (err) {
        if (!active) return;
        const fallbackDay = DUMMY_SUMMARIES.find((day) => day.date === selectedDate) ?? DUMMY_SUMMARIES[0];
        setSummaryHtml(fallbackDay.channels[selectedChannel]);
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

  return (
    <main className="relative z-10 flex-1 px-4 sm:px-8 pb-8 overflow-hidden">
      <div className="h-full grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1 gap-3 sm:gap-4 lg:gap-6 min-h-0">
        <LiquidGlassWrap
          cornerRadius={28}
          padding="0"
          blurAmount={18}
          saturation={150}
          elasticity={0.08}
          className="min-h-0 self-start lg:self-stretch lg:h-full"
          style={{ background: "rgba(0, 0, 0, 0.24)" }}
        >
          <aside className="min-h-0 p-4 sm:p-5 flex flex-col gap-4 lg:h-full">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.55)" }}>
                Daily archive
              </p>
              <h2 className="text-xl font-black tracking-tight mt-1">Communication</h2>
            </div>

            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden pb-1 lg:min-h-0">
              {availableDates.map((day) => {
                const active = day.date === selectedDate;
                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(day.date)}
                    className="text-left shrink-0 lg:shrink rounded-2xl px-4 py-3 transition min-w-[126px] lg:min-w-0"
                    style={{
                      background: active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.045)",
                      border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: active ? "0 12px 30px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.15)" : "none",
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black">{day.date}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.56)" }}>
                        {DUMMY_SUMMARIES.find((dummy) => dummy.date === day.date)?.label ?? formatLongDate(day.date).split(",")[0]}
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
                    {formatLongDate(selectedDay?.date ?? selectedDate)}
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
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
                  style={{
                    color: "rgba(255,255,255,0.9)",
                    background: `${channelMeta.tone}33`,
                    border: `1px solid ${channelMeta.tone}66`,
                  }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: channelMeta.tone, boxShadow: `0 0 12px ${channelMeta.tone}` }} />
                  {source === "remote" ? "Remote HTML source" : "Dummy HTML source"}
                </span>
                {loadingDates || loadingSummary ? (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Loading latest summary...
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Source: {source === "remote" ? "MacBook reports service" : "local fallback"}
                  </span>
                )}
                {error && (
                  <span className="text-xs" style={{ color: "rgba(255,210,120,0.85)" }}>
                    {error}
                  </span>
                )}
              </div>

              <article
                className="summary-html rounded-[28px] p-5 sm:p-7"
                style={{
                  background: "rgba(0,0,0,0.24)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 18px rgba(0,0,0,0.28)",
                }}
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            </div>
          </section>
        </LiquidGlassWrap>
      </div>
    </main>
  );
}
