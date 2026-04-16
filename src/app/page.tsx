"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import TiptapEditor, { stripHtml } from "@/components/TiptapEditor";
import {
  LiquidGlassWrap,
  GlassButton,
  GlassModal,
  GlassFormField,
  GlassDropdown,
  TactileSwitch,
  SegmentControl,
  GlassSlider,
  LayeredFAB,
} from "@/components/glass";
import gsap from "gsap";
import { useAuth } from "@/context/AuthContext";
import RainOverlay, { type RainConfig } from "@/components/RainOverlay";
import ManageSpacesModal from "@/components/ManageSpacesModal";
import BackgroundGalleryModal from "@/components/BackgroundGalleryModal";
import {
  fetchTasks,
  fetchTags,
  fetchSpaces,
  ensureDefaultSpace,
  createTask,
  updateTask,
  deleteTask,
  findOrCreateTag,
  reorderColumn,
  statusToColumn,
  getUserBackground,
  setUserBackground,
  createRecurringJob,
  updateRecurringJob,
  deleteRecurringJob,
  fetchRecurringJobForTask,
  fetchRecurringJobById,
  type PBTag,
  type PBSpace,
  type PBBackground,
  type PBRecurringJob,
} from "@/lib/pocketbase";

const ALL_SPACES = "__all__";
const ACTIVE_SPACE_STORAGE_KEY = "controlcentre.activeSpaceId";

// ─── Types ──────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  description: string;
  space: string;
  tags: string[]; // tag record IDs
  recurring_job_id?: string; // linked recurring job (empty or absent if none)
}

type Board = Record<string, Task[]>;

const COLUMNS = ["Backlog", "To Do", "In Progress", "Done"];

// ─── Tag helpers ────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Task card content ──────────────────────────────
function TaskCardContent({
  task,
  tagMap,
  spaceMap,
  showSpacePill,
}: {
  task: Task;
  tagMap: Record<string, PBTag>;
  spaceMap: Record<string, PBSpace>;
  showSpacePill: boolean;
}) {
  const space = spaceMap[task.space];
  return (
    <>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-bold break-words overflow-hidden flex-1">
          {task.recurring_job_id && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="inline-block mr-1.5 -mt-0.5 opacity-60"
              style={{ color: "rgba(99, 202, 255, 0.9)" }}
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          )}
          {task.title}
        </h3>
        {showSpacePill && space && (
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: hexToRgba(space.color || "#6366f1", 0.35),
              border: `1px solid ${hexToRgba(space.color || "#6366f1", 0.5)}`,
              color: "#fff",
            }}
          >
            {space.name}
          </span>
        )}
      </div>
      {task.description && task.description.trim().length > 0 && (
        <div
          className="text-sm mb-2 break-words overflow-hidden"
          style={{
            color: "rgba(255,255,255,0.75)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {stripHtml(task.description)}
        </div>
      )}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((tagId) => {
            const tag = tagMap[tagId];
            if (!tag) return null;
            return (
              <span
                key={tagId}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: hexToRgba(tag.color || "#6366f1", 0.35),
                  border: "1px solid rgba(255,255,255,0.12)",
                }}
              >
                {tag.name}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Search toggle (icon → expanded input) ─────────
function SearchToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMobile = () => typeof window !== "undefined" && window.innerWidth < 640;

  const expand = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.focus();
      if (!isMobile() && wrapRef.current) {
        gsap.fromTo(
          wrapRef.current,
          { width: 40 },
          { width: 220, duration: 0.4, ease: "elastic.out(1, 0.6)" }
        );
      }
    });
  }, []);

  // Desktop blur collapse — mobile uses X button only
  const collapse = useCallback(() => {
    if (isMobile()) return;
    if (value) return;
    if (!wrapRef.current) return;
    gsap.to(wrapRef.current, {
      width: 40,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => setOpen(false),
    });
  }, [value]);

  const forceCollapse = useCallback(() => {
    onChange("");
    if (!isMobile() && wrapRef.current) {
      gsap.to(wrapRef.current, {
        width: 40,
        duration: 0.25,
        ease: "power2.in",
        onComplete: () => setOpen(false),
      });
    } else {
      setOpen(false);
    }
  }, [onChange]);

  const searchIcon = (
    <svg viewBox="0 0 512 512" width="16" height="16" fill="currentColor" className="opacity-60">
      <path d="M456.69 421.39 362.6 327.3a173.81 173.81 0 0 0 34.84-104.58C397.44 126.38 319.06 48 222.72 48S48 126.38 48 222.72s78.38 174.72 174.72 174.72A173.81 173.81 0 0 0 327.3 362.6l94.09 94.09a25 25 0 0 0 35.3-35.3zM97.92 222.72a124.8 124.8 0 1 1 124.8 124.8 124.95 124.95 0 0 1-124.8-124.8z" />
    </svg>
  );

  // Mobile expanded: absolute overlay covering the full controls row
  if (open && isMobile()) {
    return (
      <div className="absolute inset-0 z-10">
        <LiquidGlassWrap
          cornerRadius={21}
          padding="0"
          blurAmount={8}
          saturation={140}
          displacementScale={80}
          shadowIntensity={0.5}
          elasticity={0}
        >
          <div className="flex items-center gap-2 w-full" style={{ padding: "0 10px", height: 40 }}>
            <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
              {searchIcon}
            </span>
            <input
              ref={inputRef}
              type="search"
              placeholder="Search tasks..."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none border-0"
              style={{
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                color: "#ffffff",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}
            />
            <button
              onClick={forceCollapse}
              className="flex-shrink-0 flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
              style={{ width: 20, height: 20 }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </LiquidGlassWrap>
      </div>
    );
  }

  // Desktop (or mobile collapsed): icon → expanding pill
  return (
    <div
      ref={wrapRef}
      style={{ width: open ? 220 : 40, willChange: "width" }}
    >
      <LiquidGlassWrap
        cornerRadius={21}
        padding="0"
        blurAmount={8}
        saturation={140}
        displacementScale={80}
        shadowIntensity={0.5}
        elasticity={0}
      >
        <div
          className="flex items-center gap-2"
          style={{ padding: "0 10px", height: 40 }}
        >
          <button
            onClick={open ? undefined : expand}
            className="flex-shrink-0 flex items-center justify-center cursor-pointer"
            style={{ width: 20, height: 20 }}
          >
            {searchIcon}
          </button>
          {open && (
            <>
              <input
                ref={inputRef}
                type="search"
                placeholder="Search tasks..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={collapse}
                className="flex-1 min-w-0 bg-transparent outline-none border-0"
                style={{
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                  color: "#ffffff",
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              />
              <button
                onMouseDown={(e) => { e.preventDefault(); forceCollapse(); }}
                className="flex-shrink-0 flex items-center justify-center cursor-pointer opacity-60 hover:opacity-100"
                style={{ width: 20, height: 20 }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </>
          )}
        </div>
      </LiquidGlassWrap>
    </div>
  );
}

// ─── Component ──────────────────────────────────────
export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const emptyBoard: Board = { Backlog: [], "To Do": [], "In Progress": [], Done: [] };
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [tagMap, setTagMap] = useState<Record<string, PBTag>>({});
  const [loading, setLoading] = useState(true);

  // Spaces
  const [spaces, setSpaces] = useState<PBSpace[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string>(ALL_SPACES);
  const [spacesModalOpen, setSpacesModalOpen] = useState(false);

  // Unified modal state: null = closed, "new" = create, { task, column } = edit
  const [editingTask, setEditingTask] = useState<{ task: Task; column: string } | "new" | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalSpaceId, setModalSpaceId] = useState<string>("");
  const [modalTagInput, setModalTagInput] = useState("");
  const [modalTags, setModalTags] = useState<string[]>([]); // tag names
  const [tagEditOpen, setTagEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Recurring task modal state
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringPeriod, setRecurringPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [existingRecurringJob, setExistingRecurringJob] = useState<PBRecurringJob | null>(null);

  // Build lookup maps
  const spaceMap = useMemo(() => {
    const m: Record<string, PBSpace> = {};
    for (const s of spaces) m[s.id] = s;
    return m;
  }, [spaces]);

  // Background gallery
  const [bgGalleryOpen, setBgGalleryOpen] = useState(false);
  const [activeBackground, setActiveBackground] = useState<PBBackground | null>(null);

  // Rain overlay
  const [rainActive, setRainActive] = useState(false);
  const [rainConfig, setRainConfig] = useState<RainConfig>({
    intensity: 2, wind: 0.5, opacity: 0.7,
    splatterSize: 0.5, splatterParticleCount: 5, speedMin: 12, speedMax: 20, speed: 2,
  });
  const [rainModalOpen, setRainModalOpen] = useState(false);
  const rainSlidersRef = useRef<HTMLDivElement>(null);
  const rainFirstRunRef = useRef(true);
  const [rainVolume, setRainVolume] = useState(0.5);
  const rainCtxRef = useRef<AudioContext | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const rainSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rainBufferRef = useRef<AudioBuffer | null>(null);
  const rainFadeRef = useRef<ReturnType<typeof gsap.to> | null>(null);

  // Reset the first-run flag whenever the rain modal mounts/unmounts so
  // the next mount snaps to the correct initial state without animating.
  useEffect(() => {
    if (!rainModalOpen) rainFirstRunRef.current = true;
  }, [rainModalOpen]);

  // Animate the rain sliders' visibility when rainActive toggles.
  // Uses useLayoutEffect so the initial collapsed state is applied
  // before paint (no flash of expanded sliders on mount). Keyed on
  // rainModalOpen too because the wrapper element only exists while
  // the modal is mounted — the effect must re-run on modal open.
  useLayoutEffect(() => {
    if (!rainModalOpen) return;
    const wrap = rainSlidersRef.current;
    if (!wrap) return;
    const rows = wrap.querySelectorAll<HTMLElement>(".rain-slider-row");

    // First run after mount: snap to current rainActive state, no animation
    if (rainFirstRunRef.current) {
      rainFirstRunRef.current = false;
      if (rainActive) {
        gsap.set(wrap, { height: "auto", opacity: 1, overflow: "visible" });
        gsap.set(rows, { y: 0, opacity: 1, clearProps: "transform" });
      } else {
        gsap.set(wrap, { height: 0, opacity: 0, overflow: "hidden" });
        gsap.set(rows, { y: 18, opacity: 0 });
      }
      return;
    }

    if (rainActive) {
      // Measure target height by temporarily setting height: auto
      gsap.set(wrap, { height: "auto", overflow: "hidden" });
      const target = wrap.offsetHeight;
      gsap.fromTo(
        wrap,
        { height: 0, opacity: 0 },
        {
          height: target,
          opacity: 1,
          duration: 0.55,
          ease: "power3.out",
          onComplete: () => {
            gsap.set(wrap, { height: "auto", overflow: "visible" });
          },
        }
      );
      gsap.fromTo(
        rows,
        { y: 18, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "elastic.out(1, 0.7)",
          stagger: 0.08,
          delay: 0.08,
        }
      );
    } else {
      gsap.set(wrap, { overflow: "hidden" });
      gsap.to(rows, {
        y: -10,
        opacity: 0,
        duration: 0.22,
        ease: "power2.in",
        stagger: { each: 0.04, from: "end" },
      });
      gsap.to(wrap, {
        height: 0,
        opacity: 0,
        duration: 0.32,
        ease: "power2.in",
        delay: 0.1,
      });
    }
  }, [rainActive, rainModalOpen]);

  // Rain sound: gapless Web Audio API loop tied to rainActive
  useEffect(() => {
    if (rainActive) {
      // Kill any in-progress fade-out
      if (rainFadeRef.current) {
        rainFadeRef.current.kill();
        rainFadeRef.current = null;
      }

      const start = async () => {
        // Create AudioContext + GainNode once
        if (!rainCtxRef.current) {
          const ctx = new AudioContext();
          const gain = ctx.createGain();
          gain.connect(ctx.destination);
          rainCtxRef.current = ctx;
          rainGainRef.current = gain;
        }

        const ctx = rainCtxRef.current;
        if (ctx.state === "suspended") await ctx.resume();

        // Decode buffer once
        if (!rainBufferRef.current) {
          const res = await fetch("/sounds/rain.mp3");
          const arrayBuf = await res.arrayBuffer();
          rainBufferRef.current = await ctx.decodeAudioData(arrayBuf);
        }

        // Stop previous source if any
        if (rainSourceRef.current) {
          rainSourceRef.current.stop();
          rainSourceRef.current.disconnect();
        }

        // Create a new looping source
        const source = ctx.createBufferSource();
        source.buffer = rainBufferRef.current;
        source.loop = true;
        source.connect(rainGainRef.current!);
        rainGainRef.current!.gain.value = rainVolume;
        source.start();
        rainSourceRef.current = source;
      };

      start().catch(() => {/* autoplay blocked — user will interact */});
    } else if (rainSourceRef.current && rainGainRef.current) {
      // Fade out over 1s then stop
      const gain = rainGainRef.current;
      const source = rainSourceRef.current;
      const obj = { vol: gain.gain.value };
      rainFadeRef.current = gsap.to(obj, {
        vol: 0,
        duration: 1,
        ease: "power2.out",
        onUpdate: () => { gain.gain.value = obj.vol; },
        onComplete: () => {
          source.stop();
          source.disconnect();
          rainSourceRef.current = null;
          rainFadeRef.current = null;
        },
      });
    }
  }, [rainActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume slider to GainNode in real-time
  useEffect(() => {
    if (rainGainRef.current && rainActive) {
      rainGainRef.current.gain.value = rainVolume;
    }
  }, [rainVolume, rainActive]);

  // Search / filter
  const [searchQuery, setSearchQuery] = useState("");

  // ─── Redirect if not authenticated ─────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // ─── Load data from PocketBase ──────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Ensure user has at least one space (migrates existing data on first run)
      await ensureDefaultSpace(user.id);

      const [spacesList, tasks, tags, userBg] = await Promise.all([
        fetchSpaces(user.id),
        fetchTasks(user.id),
        fetchTags(user.id),
        getUserBackground(user.id).catch(() => null),
      ]);

      setActiveBackground(userBg);

      setSpaces(spacesList);

      // Restore active space from localStorage (or default to ALL)
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY)
          : null;
      if (
        stored &&
        (stored === ALL_SPACES || spacesList.some((s) => s.id === stored))
      ) {
        setActiveSpaceId(stored);
      } else {
        setActiveSpaceId(ALL_SPACES);
      }

      // Build tag map
      const map: Record<string, PBTag> = {};
      for (const tag of tags) map[tag.id] = tag;
      setTagMap(map);

      // Build board from tasks
      const b: Board = { Backlog: [], "To Do": [], "In Progress": [], Done: [] };
      for (const task of tasks) {
        const col = statusToColumn(task.status);
        if (b[col]) {
          b[col].push({
            id: task.id,
            title: task.title,
            description: task.description,
            space: task.space,
            tags: task.tags,
            recurring_job_id: task.recurring_job_id || undefined,
          });
        }
      }
      setBoard(b);
    } catch (err) {
      console.error("Failed to load from PocketBase:", err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist active space selection
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!loading) {
      localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, activeSpaceId);
    }
  }, [activeSpaceId, loading]);

  // Called when ManageSpacesModal mutates spaces
  const handleSpacesChanged = useCallback(
    async (list: PBSpace[]) => {
      setSpaces(list);
      // If active space was deleted, fall back to All
      if (
        activeSpaceId !== ALL_SPACES &&
        !list.some((s) => s.id === activeSpaceId)
      ) {
        setActiveSpaceId(ALL_SPACES);
      }
      // Reload tasks + tags in case spaces were deleted (cascade)
      if (!user) return;
      try {
        const [tasks, tags] = await Promise.all([
          fetchTasks(user.id),
          fetchTags(user.id),
        ]);
        const map: Record<string, PBTag> = {};
        for (const tag of tags) map[tag.id] = tag;
        setTagMap(map);
        const b: Board = { Backlog: [], "To Do": [], "In Progress": [], Done: [] };
        for (const task of tasks) {
          const col = statusToColumn(task.status);
          if (b[col]) {
            b[col].push({
              id: task.id,
              title: task.title,
              description: task.description,
              space: task.space,
              tags: task.tags,
            });
          }
        }
        setBoard(b);
      } catch (err) {
        console.error("Failed to reload after spaces change:", err);
      }
    },
    [user, activeSpaceId]
  );

  // Drag state — only the dragged task id is in React state (for drop indicators)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    column: string;
    index: number;
  } | null>(null);

  // Refs
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const boardScrollRef = useRef<HTMLElement | null>(null);

  // Mutable drag state (avoids re-renders on every pixel)
  const dragRef = useRef<{
    taskId: string;
    task: Task;
    sourceColumn: string;
    el: HTMLElement;
    placeholder: HTMLElement;
    originalParent: HTMLElement;
    originalNext: Node | null;
    startRect: DOMRect;
    offsetX: number;
    offsetY: number;
    prevX: number;
    prevY: number;
    tiltX: number;
    tiltY: number;
  } | null>(null);

  // Mirror state in refs for event handlers
  const boardRef = useRef(board);
  const dropTargetRef = useRef(dropTarget);
  const tagMapRef = useRef(tagMap);
  const activeSpaceIdRef = useRef(activeSpaceId);
  const searchQueryRef = useRef(searchQuery);
  boardRef.current = board;
  dropTargetRef.current = dropTarget;
  tagMapRef.current = tagMap;
  activeSpaceIdRef.current = activeSpaceId;
  searchQueryRef.current = searchQuery;

  // FLIP animation refs
  const animCardId = useRef<string | null>(null);
  const preDropRect = useRef<{ x: number; y: number } | null>(null);
  const preDropTilt = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto-scroll state during drag (for mobile / horizontally-scrolled board)
  const autoScrollRAF = useRef<number | null>(null);
  const autoScrollVel = useRef<{ x: number; y: number; colEl: HTMLElement | null }>({
    x: 0,
    y: 0,
    colEl: null,
  });

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRAF.current != null) {
      cancelAnimationFrame(autoScrollRAF.current);
      autoScrollRAF.current = null;
    }
    autoScrollVel.current = { x: 0, y: 0, colEl: null };
  }, []);

  const tickAutoScroll = useCallback(() => {
    const v = autoScrollVel.current;
    const main = boardScrollRef.current;
    if (main && v.x !== 0) main.scrollLeft += v.x;
    if (v.colEl && v.y !== 0) v.colEl.scrollTop += v.y;
    if (v.x !== 0 || v.y !== 0) {
      autoScrollRAF.current = requestAnimationFrame(tickAutoScroll);
    } else {
      autoScrollRAF.current = null;
    }
  }, []);

  // ─── Begin a real drag (called once activation threshold met) ──
  const startDrag = useCallback(
    (
      el: HTMLElement,
      task: Task,
      column: string,
      pointerId: number,
      clientX: number,
      clientY: number
    ) => {
      const rect = el.getBoundingClientRect();

      try {
        el.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }

      dragRef.current = {
        taskId: task.id,
        task,
        sourceColumn: column,
        el,
        placeholder: null!,
        originalParent: null!,
        originalNext: null,
        startRect: rect,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
        prevX: clientX,
        prevY: clientY,
        tiltX: 0,
        tiltY: 0,
      };

      setDraggedTaskId(task.id);

      const placeholder = document.createElement("div");
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.transition = "height 0.2s ease";

      const originalParent = el.parentElement!;
      const originalNext = el.nextSibling;

      dragRef.current.placeholder = placeholder;
      dragRef.current.originalParent = originalParent;
      dragRef.current.originalNext = originalNext;

      originalParent.insertBefore(placeholder, el);
      document.body.appendChild(el);

      el.style.willChange = "transform";
      el.style.position = "fixed";
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.zIndex = "200";
      el.style.pointerEvents = "none";
      el.style.margin = "0";
      el.style.touchAction = "none";
      el.style.borderRadius = "16px";
      el.style.overflow = "hidden";

      // Lock the page so the browser can't scroll while dragging.
      // touchAction on the card alone is insufficient because the browser
      // already committed to a pan gesture at touchstart — we need a
      // non-passive touchmove listener that calls preventDefault().
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlTouchAction = document.documentElement.style.touchAction;
      const prevBodyTouchAction = document.body.style.touchAction;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.documentElement.style.touchAction = "none";
      document.body.style.touchAction = "none";

      const blockTouchMove = (ev: TouchEvent) => {
        if (ev.cancelable) ev.preventDefault();
      };
      document.addEventListener("touchmove", blockTouchMove, { passive: false });

      el.style.transformStyle = "preserve-3d";
      el.style.perspective = "600px";
      gsap.to(el, {
        scale: 1.05,
        boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.3)",
        duration: 0.3,
        ease: "back.out(1.7)",
      });

      // ─── Document-level move/up handlers (attached now, removed on up) ──
      const handleMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        ev.preventDefault();

        d.el.style.left = `${ev.clientX - d.offsetX}px`;
        d.el.style.top = `${ev.clientY - d.offsetY}px`;

        // 3D tilt based on pointer velocity
        const dx = ev.clientX - d.prevX;
        const dy = ev.clientY - d.prevY;
        const MAX_TILT = 12;
        const SMOOTHING = 0.25;
        // rotateY follows horizontal movement, rotateX opposes vertical
        const targetTiltY = Math.max(-MAX_TILT, Math.min(MAX_TILT, dx * 1.5));
        const targetTiltX = Math.max(-MAX_TILT, Math.min(MAX_TILT, -dy * 1.5));
        d.tiltY += (targetTiltY - d.tiltY) * SMOOTHING;
        d.tiltX += (targetTiltX - d.tiltX) * SMOOTHING;
        d.prevX = ev.clientX;
        d.prevY = ev.clientY;
        gsap.set(d.el, {
          rotateX: d.tiltX,
          rotateY: d.tiltY,
          transformPerspective: 600,
        });

        // Find column under pointer (with horizontal tolerance for narrow viewports)
        let newDrop: { column: string; index: number } | null = null;
        let activeColEl: HTMLElement | null = null;
        let bestDist = Infinity;

        for (const col of COLUMNS) {
          const colEl = columnRefs.current[col];
          if (!colEl) continue;
          const r = colEl.getBoundingClientRect();
          // Vertical band check + nearest column horizontally (handles being slightly off)
          if (ev.clientY < r.top - 40 || ev.clientY > r.bottom + 40) continue;
          const cx = (r.left + r.right) / 2;
          const dist =
            ev.clientX >= r.left && ev.clientX <= r.right
              ? 0
              : Math.abs(ev.clientX - cx);
          if (dist < bestDist) {
            bestDist = dist;
            const spaceId = activeSpaceIdRef.current;
            const query = searchQueryRef.current.trim().toLowerCase();
            const spaceTasks =
              spaceId === ALL_SPACES
                ? boardRef.current[col]
                : boardRef.current[col].filter((t) => t.space === spaceId);
            const filtered = query
              ? spaceTasks.filter((t) => {
                  if (t.title.toLowerCase().includes(query)) return true;
                  if (t.description && stripHtml(t.description).toLowerCase().includes(query)) return true;
                  const tm = tagMapRef.current;
                  return t.tags.some((tagId) => {
                    const tag = tm[tagId];
                    return tag && tag.name.toLowerCase().includes(query);
                  });
                })
              : spaceTasks;
            const colTasks = filtered.filter(
              (t) => t.id !== d.taskId
            );
            let insertIndex = colTasks.length;
            for (let i = 0; i < colTasks.length; i++) {
              const cardEl = cardRefs.current[colTasks[i].id];
              if (cardEl) {
                const cr = cardEl.getBoundingClientRect();
                if (ev.clientY < cr.top + cr.height / 2) {
                  insertIndex = i;
                  break;
                }
              }
            }
            newDrop = { column: col, index: insertIndex };
            activeColEl = colEl;
          }
        }

        setDropTarget((prev) => {
          if (!newDrop && !prev) return prev;
          if (
            newDrop &&
            prev &&
            newDrop.column === prev.column &&
            newDrop.index === prev.index
          )
            return prev;
          return newDrop;
        });

        // ─── Edge auto-scroll ─────────────────────────
        const EDGE = 60;
        const MAX_SPEED = 18;
        let vx = 0;
        let vy = 0;

        const main = boardScrollRef.current;
        if (main) {
          const mr = main.getBoundingClientRect();
          if (ev.clientX < mr.left + EDGE) {
            vx = -MAX_SPEED * Math.min(1, (mr.left + EDGE - ev.clientX) / EDGE);
          } else if (ev.clientX > mr.right - EDGE) {
            vx = MAX_SPEED * Math.min(1, (ev.clientX - (mr.right - EDGE)) / EDGE);
          }
        }

        // Vertical auto-scroll within the active column's card area
        let scrollColEl: HTMLElement | null = null;
        if (activeColEl) {
          const cardsArea = activeColEl.querySelector<HTMLElement>(
            ".overflow-y-auto"
          );
          if (cardsArea) {
            scrollColEl = cardsArea;
            const cr = cardsArea.getBoundingClientRect();
            if (ev.clientY < cr.top + EDGE) {
              vy = -MAX_SPEED * Math.min(1, (cr.top + EDGE - ev.clientY) / EDGE);
            } else if (ev.clientY > cr.bottom - EDGE) {
              vy =
                MAX_SPEED *
                Math.min(1, (ev.clientY - (cr.bottom - EDGE)) / EDGE);
            }
          }
        }

        autoScrollVel.current = { x: vx, y: vy, colEl: scrollColEl };
        if ((vx !== 0 || vy !== 0) && autoScrollRAF.current == null) {
          autoScrollRAF.current = requestAnimationFrame(tickAutoScroll);
        }
      };

      const finish = () => {
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
        document.removeEventListener("pointercancel", handleUp);
        document.removeEventListener("touchmove", blockTouchMove);
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.touchAction = prevHtmlTouchAction;
        document.body.style.touchAction = prevBodyTouchAction;
        stopAutoScroll();

        const d = dragRef.current;
        const dt = dropTargetRef.current;
        if (!d) return;

        const currentRect = d.el.getBoundingClientRect();
        preDropRect.current = { x: currentRect.left, y: currentRect.top };
        animCardId.current = d.taskId;
        preDropTilt.current = { x: d.tiltX, y: d.tiltY };

        gsap.set(d.el, { clearProps: "all" });
        d.el.style.position = "";
        d.el.style.left = "";
        d.el.style.top = "";
        d.el.style.width = "";
        d.el.style.zIndex = "";
        d.el.style.pointerEvents = "";
        d.el.style.margin = "";
        d.el.style.willChange = "";
        d.el.style.touchAction = "";
        d.el.style.transformStyle = "";
        d.el.style.perspective = "";
        d.el.style.borderRadius = "";
        d.el.style.overflow = "";

        if (d.placeholder.parentElement) {
          d.placeholder.parentElement.insertBefore(d.el, d.placeholder);
          d.placeholder.remove();
        }

        if (dt) {
          setBoard((prev) => {
            const next: Board = {};
            for (const col of COLUMNS) {
              next[col] = prev[col].filter((t) => t.id !== d.taskId);
            }
            const targetAll = next[dt.column];

            // Map the filtered drop index to the correct position in the full array
            const spaceId = activeSpaceIdRef.current;
            const query = searchQueryRef.current.trim().toLowerCase();
            const targetFiltered = targetAll.filter((t) => {
              if (spaceId !== ALL_SPACES && t.space !== spaceId) return false;
              if (query) {
                if (t.title.toLowerCase().includes(query)) return true;
                if (t.description && stripHtml(t.description).toLowerCase().includes(query)) return true;
                const tm = tagMapRef.current;
                return t.tags.some((tagId) => {
                  const tag = tm[tagId];
                  return tag && tag.name.toLowerCase().includes(query);
                });
              }
              return true;
            });

            let realIndex: number;
            if (dt.index >= targetFiltered.length) {
              realIndex = targetAll.length;
            } else {
              const refTask = targetFiltered[dt.index];
              realIndex = targetAll.indexOf(refTask);
            }

            const target = [...targetAll];
            target.splice(realIndex, 0, d.task);
            next[dt.column] = target;

            reorderColumn(dt.column, target.map((t) => t.id)).catch((err) =>
              console.error("Failed to persist reorder:", err)
            );

            return next;
          });
        }

        dragRef.current = null;
        setDraggedTaskId(null);
        setDropTarget(null);

        // FLIP: animate from pre-drop screen position to new DOM position
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const cardId = animCardId.current;
            const from = preDropRect.current;
            if (!cardId || !from) return;

            const cardEl = cardRefs.current[cardId];
            if (!cardEl) {
              animCardId.current = null;
              preDropRect.current = null;
              return;
            }

            const to = cardEl.getBoundingClientRect();
            const dx = from.x - to.left;
            const dy = from.y - to.top;

            const tilt = preDropTilt.current;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              gsap.fromTo(
                cardEl,
                {
                  x: dx,
                  y: dy,
                  scale: 1.05,
                  rotateX: tilt.x,
                  rotateY: tilt.y,
                  transformPerspective: 600,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.3)",
                },
                {
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotateX: 0,
                  rotateY: 0,
                  boxShadow: "none",
                  duration: 0.5,
                  ease: "power2.out",
                  clearProps: "all",
                  onComplete: () => {
                    animCardId.current = null;
                    preDropRect.current = null;
                  },
                }
              );
            } else {
              gsap.to(cardEl, {
                scale: 1,
                rotateX: 0,
                rotateY: 0,
                boxShadow: "none",
                duration: 0.3,
                ease: "elastic.out(1, 0.5)",
                clearProps: "all",
              });
              animCardId.current = null;
              preDropRect.current = null;
            }
          });
        });
      };

      const handleUp = () => finish();

      document.addEventListener("pointermove", handleMove, { passive: false });
      document.addEventListener("pointerup", handleUp);
      document.addEventListener("pointercancel", handleUp);
    },
    [stopAutoScroll, tickAutoScroll]
  );

  // ─── Pointerdown: long-press (touch) or threshold (mouse) gate ──
  const openEditModalForTask = useCallback(
    async (task: Task, column: string) => {
      setModalTitle(task.title);
      setModalDescription(task.description || "");
      setModalSpaceId(task.space || "");
      const taskTagNames = task.tags
        .map((id) => tagMapRef.current[id]?.name)
        .filter(Boolean) as string[];
      setModalTags(taskTagNames);
      setModalTagInput("");

      // Load recurring job data
      setRecurringEnabled(false);
      setRecurringPeriod("daily");
      setRecurringDays([]);
      setExistingRecurringJob(null);

      let job: PBRecurringJob | null = null;
      if (task.recurring_job_id) {
        job = await fetchRecurringJobById(task.recurring_job_id);
      }
      if (!job) {
        job = await fetchRecurringJobForTask(task.id);
      }
      if (job) {
        setExistingRecurringJob(job);
        setRecurringEnabled(job.is_active);
        setRecurringPeriod(job.period);
        setRecurringDays(job.days ?? []);
      }

      setEditingTask({ task, column });
    },
    []
  );

  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent, task: Task, column: string) => {
      // Ignore secondary buttons
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const el = e.currentTarget as HTMLElement;
      const isTouch = e.pointerType === "touch";
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;

      let activated = false;
      let cancelled = false;
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (longPressTimer != null) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        el.removeEventListener("pointermove", onPreMove);
        el.removeEventListener("pointerup", onPreUp);
        el.removeEventListener("pointercancel", onPreCancel);
      };

      const activate = (cx: number, cy: number) => {
        if (activated || cancelled) return;
        activated = true;
        cleanup();
        if (isTouch && typeof navigator !== "undefined" && navigator.vibrate) {
          try {
            navigator.vibrate(15);
          } catch {
            /* ignore */
          }
        }
        startDrag(el, task, column, pointerId, cx, cy);
      };

      function onPreMove(ev: PointerEvent) {
        if (activated || cancelled) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const dist = Math.hypot(dx, dy);
        if (isTouch) {
          // Movement before long-press fires → user is scrolling, abort drag intent
          if (dist > 8) {
            cancelled = true;
            cleanup();
          }
        } else {
          if (dist > 4) activate(ev.clientX, ev.clientY);
        }
      }

      function onPreUp(ev: PointerEvent) {
        if (activated) return;
        cleanup();
        if (cancelled) return;
        // No drag occurred → treat as tap to open edit modal
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (Math.hypot(dx, dy) < 10) {
          openEditModalForTask(task, column);
        }
      }

      function onPreCancel() {
        cancelled = true;
        cleanup();
      }

      el.addEventListener("pointermove", onPreMove);
      el.addEventListener("pointerup", onPreUp);
      el.addEventListener("pointercancel", onPreCancel);

      if (isTouch) {
        // Long-press to start drag on touch (allows native scroll otherwise)
        longPressTimer = setTimeout(() => activate(startX, startY), 220);
      }
    },
    [startDrag, openEditModalForTask]
  );

  // ─── Column highlight on drag hover ─────────────
  useEffect(() => {
    for (const col of COLUMNS) {
      const colEl = columnRefs.current[col];
      if (!colEl) continue;

      if (draggedTaskId && dropTarget?.column === col) {
        gsap.to(colEl, {
          boxShadow:
            "inset 0 0 40px rgba(99, 102, 241, 0.12), 0 0 24px rgba(99, 102, 241, 0.08)",
          borderColor: "rgba(99, 102, 241, 0.35)",
          scale: 1.015,
          duration: 0.3,
          ease: "power2.out",
        });
      } else {
        gsap.to(colEl, {
          boxShadow: "none",
          borderColor: "rgba(255, 255, 255, 0.06)",
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    }
  }, [dropTarget, draggedTaskId]);

  // ─── Modal helpers ──────────────────────────────
  const isEditing = editingTask !== null && editingTask !== "new";
  const modalOpen = editingTask !== null;

  const openAddTaskModal = useCallback(() => {
    setModalTitle("");
    setModalDescription("");
    setModalTags([]);
    setModalTagInput("");
    setRecurringEnabled(false);
    setRecurringPeriod("daily");
    setRecurringDays([]);
    setExistingRecurringJob(null);
    const preferred =
      activeSpaceIdRef.current !== ALL_SPACES
        ? activeSpaceIdRef.current
        : spaces.find((s) => s.is_default)?.id ?? spaces[0]?.id ?? "";
    setModalSpaceId(preferred);
    setEditingTask("new");
  }, [spaces]);

  const closeModal = useCallback(() => {
    setEditingTask(null);
    setModalTitle("");
    setModalDescription("");
    setModalSpaceId("");
    setModalTags([]);
    setModalTagInput("");
    setTagEditOpen(false);
    setRecurringEnabled(false);
    setRecurringPeriod("daily");
    setRecurringDays([]);
    setExistingRecurringJob(null);
  }, []);

  // When space changes in the modal, clear the tag selection (tags are space-scoped)
  const handleModalSpaceChange = useCallback((newSpaceId: string) => {
    setModalSpaceId((prev) => {
      if (prev && prev !== newSpaceId) {
        setModalTags([]);
        setModalTagInput("");
      }
      return newSpaceId;
    });
  }, []);

  // Tags available for the currently selected modal space.
  // Strictly scoped: only tags whose space matches the selected space.
  const modalSpaceTags = useMemo(() => {
    if (!modalSpaceId) return [] as PBTag[];
    return Object.values(tagMap)
      .filter((t) => t.space === modalSpaceId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tagMap, modalSpaceId]);

  const toggleModalTag = useCallback((name: string) => {
    setModalTags((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const handleRemoveTag = useCallback((index: number) => {
    setModalTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === "Enter" || e.key === ",") && modalTagInput.trim()) {
        e.preventDefault();
        setModalTags((prev) => [...prev, modalTagInput.trim()]);
        setModalTagInput("");
      }
      if (e.key === "Backspace" && !modalTagInput && modalTags.length > 0) {
        setModalTags((prev) => prev.slice(0, -1));
      }
    },
    [modalTagInput, modalTags.length]
  );

  // ─── Save task (create or update) ──────────────
  const handleSaveTask = useCallback(async () => {
    if (!modalTitle.trim() || !modalSpaceId || saving) return;
    setSaving(true);

    try {
      // Resolve tag names to IDs (find or create) — scoped to the task's space
      const resolvedTags = await Promise.all(
        modalTags.map((name) => findOrCreateTag(name, user!.id, modalSpaceId))
      );
      const tagIds = resolvedTags.map((t) => t.id);

      // Update tag map with any new tags
      setTagMap((prev) => {
        const next = { ...prev };
        for (const t of resolvedTags) next[t.id] = t;
        return next;
      });

      if (isEditing) {
        // Update existing task
        const { task, column } = editingTask as { task: Task; column: string };
        await updateTask(task.id, {
          title: modalTitle.trim(),
          description: modalDescription,
          space: modalSpaceId,
          tags: tagIds,
        });

        // Handle recurring job changes
        if (existingRecurringJob) {
          if (!recurringEnabled) {
            // Was on, now off → soft delete
            await deleteRecurringJob(existingRecurringJob.id);
          } else if (
            existingRecurringJob.period !== recurringPeriod ||
            JSON.stringify(existingRecurringJob.days) !== JSON.stringify(recurringDays.length > 0 ? recurringDays : null)
          ) {
            // Config changed → update
            await updateRecurringJob(existingRecurringJob.id, {
              period: recurringPeriod,
              days: recurringPeriod === "daily" ? null : recurringDays,
              is_active: true,
            });
          }
        } else if (recurringEnabled) {
          // No existing job, user enabled recurring → create
          await createRecurringJob({
            owner: user!.id,
            template_task_id: task.id,
            period: recurringPeriod,
            days: recurringPeriod === "daily" ? null : recurringDays,
          });
        }

        const updatedTask: Task = {
          id: task.id,
          title: modalTitle.trim(),
          description: modalDescription,
          space: modalSpaceId,
          tags: tagIds,
          recurring_job_id: task.recurring_job_id,
        };

        setBoard((prev) => ({
          ...prev,
          [column]: prev[column].map((t) =>
            t.id === task.id ? updatedTask : t
          ),
        }));
      } else {
        // Create new task
        const backlogCount = board.Backlog.length;
        const pbTask = await createTask({
          title: modalTitle.trim(),
          description: modalDescription,
          status: "backlog",
          tags: tagIds,
          space: modalSpaceId,
          sort_order: backlogCount + 1,
          owner: user!.id,
        });

        // Create recurring job if enabled
        let recurringJobId: string | undefined;
        if (recurringEnabled) {
          const job = await createRecurringJob({
            owner: user!.id,
            template_task_id: pbTask.id,
            period: recurringPeriod,
            days: recurringPeriod === "daily" ? null : recurringDays,
          });
          recurringJobId = job.id;
        }

        const task: Task = {
          id: pbTask.id,
          title: pbTask.title,
          description: pbTask.description,
          space: pbTask.space,
          tags: pbTask.tags,
          recurring_job_id: recurringJobId,
        };

        setBoard((prev) => ({
          ...prev,
          Backlog: [...prev.Backlog, task],
        }));
      }

      closeModal();
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setSaving(false);
    }
  }, [
    modalTitle,
    modalDescription,
    modalSpaceId,
    modalTags,
    saving,
    isEditing,
    editingTask,
    board.Backlog.length,
    closeModal,
    user,
    recurringEnabled,
    recurringPeriod,
    recurringDays,
    existingRecurringJob,
  ]);

  // ─── Delete task (soft) ─────────────────────────
  const handleDeleteTask = useCallback(async () => {
    if (!isEditing || deleting) return;
    const { task } = editingTask as { task: Task; column: string };
    setDeleting(true);
    try {
      await deleteTask(task.id);
      setBoard((prev) => {
        const next: Board = {};
        for (const col of COLUMNS) {
          next[col] = prev[col].filter((t) => t.id !== task.id);
        }
        return next;
      });
      closeModal();
    } catch (err) {
      console.error("Failed to delete task:", err);
    } finally {
      setDeleting(false);
    }
  }, [isEditing, editingTask, deleting, closeModal]);

  // ─── Keyboard shortcuts ─────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditable =
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";

      // "N" → open Add Task modal (only when nothing is open and not typing)
      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!modalOpen && !spacesModalOpen && !bgGalleryOpen && !rainModalOpen && !isEditable) {
          e.preventDefault();
          openAddTaskModal();
        }
      }

      // Enter → create/save task (only when task modal is open)
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (modalOpen) {
          if (target.isContentEditable) return; // typing in TiptapEditor
          if (tagEditOpen) return;               // typing a new tag
          e.preventDefault();
          handleSaveTask();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen, spacesModalOpen, bgGalleryOpen, rainModalOpen, tagEditOpen, openAddTaskModal, handleSaveTask]);

  // ─── Render ─────────────────────────────────────
  if (authLoading || !user) return null;

  return (
    <>
      <div className="h-screen bg-background relative overflow-hidden flex flex-col">
        {/* Dynamic background */}
        {activeBackground ? (
          activeBackground.type === "video" ? (
            <video
              key={activeBackground.id}
              className="absolute inset-0 z-0 w-full h-full object-cover"
              src={activeBackground.fileUrl}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              key={activeBackground.id}
              className="absolute inset-0 z-0 w-full h-full object-cover"
              src={activeBackground.fileUrl}
              alt={activeBackground.name}
            />
          )
        ) : (
          <video
            className="absolute inset-0 z-0 w-full h-full object-cover"
            src="/background.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
        )}

        {/* Dim overlay for readability */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: "rgba(0, 0, 0, 0.1)" }}
        />

        {/* Header */}
        <header className="relative z-30 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <h1 className="text-lg sm:text-3xl font-bold tracking-tight text-foreground">
            Control Centre
          </h1>
          <div className="relative flex items-center justify-between sm:justify-start sm:gap-4 min-w-0">
            {/* Space switcher */}
            <GlassDropdown
              size="sm"
              width={200}
              value={activeSpaceId}
              options={[
                {
                  id: ALL_SPACES,
                  label: "All Spaces",
                  icon: (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  ),
                },
                ...spaces.map((s) => ({
                  id: s.id,
                  label: s.name + (s.is_default ? " ★" : ""),
                  icon: (
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: s.color,
                        boxShadow: `0 0 6px ${s.color}`,
                      }}
                    />
                  ),
                })),
                {
                  id: "__manage__",
                  label: "Manage Spaces...",
                  icon: (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  ),
                },
              ]}
              onChange={(opt) => {
                if (opt.id === "__manage__") {
                  setSpacesModalOpen(true);
                } else {
                  setActiveSpaceId(opt.id);
                }
              }}
            />
            <div className="flex items-center gap-3">
            <SearchToggle
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <GlassButton size="sm" onClick={openAddTaskModal}>
              <span className="flex items-center gap-2">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden sm:inline">Add Task</span>
              </span>
            </GlassButton>
            </div>
          </div>
          </div>
        </header>

        {/* Kanban board */}
        <main ref={boardScrollRef} className="relative z-10 flex-1 px-4 sm:px-8 pb-8 overflow-x-auto overflow-y-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Loading tasks...
              </p>
            </div>
          )}
          <div className="flex gap-5 h-full" style={{ display: loading ? "none" : undefined }}>
            {COLUMNS.map((column) => {
              const query = searchQuery.trim().toLowerCase();
              // First filter by active space, then by search query
              const spaceFiltered =
                activeSpaceId === ALL_SPACES
                  ? board[column]
                  : board[column].filter((t) => t.space === activeSpaceId);
              const tasks = query
                ? spaceFiltered.filter((t) => {
                    if (t.title.toLowerCase().includes(query)) return true;
                    if (
                      t.description &&
                      stripHtml(t.description).toLowerCase().includes(query)
                    )
                      return true;
                    return t.tags.some((tagId) => {
                      const tag = tagMap[tagId];
                      return tag && tag.name.toLowerCase().includes(query);
                    });
                  })
                : spaceFiltered;
              const visibleTasks = tasks.filter(
                (t) => t.id !== draggedTaskId
              );
              const isDropColumn = dropTarget?.column === column;

              return (
                <div
                  key={column}
                  ref={(el) => {
                    columnRefs.current[column] = el;
                  }}
                  className="flex flex-col h-full rounded-2xl overflow-clip min-w-[220px] flex-1"
                  style={{
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    background: "rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {/* Column header */}
                  <div className="flex-shrink-0 p-3">
                    <LiquidGlassWrap
                      cornerRadius={14}
                      padding="12px 16px"
                      blurAmount={12}
                      displacementScale={40}
                      elasticity={0}
                      shadowIntensity={0.5}
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-widest">
                          {column}
                        </h2>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: "rgba(255, 255, 255, 0.1)",
                            color: "#ffffff",
                          }}
                        >
                          {tasks.length}
                        </span>
                      </div>
                    </LiquidGlassWrap>
                  </div>

                  {/* Cards area */}
                  <div className="flex-1 overflow-y-auto overflow-x-visible px-3 pb-3">
                    <div className="flex flex-col gap-3">
                      {tasks.map((task, i) => {
                        const visibleIndex = visibleTasks.indexOf(task);

                        return (
                          <Fragment key={task.id}>
                            {/* Drop indicator gap */}
                            {task.id !== draggedTaskId &&
                              isDropColumn &&
                              dropTarget.index === visibleIndex && (
                                <div
                                  className="rounded-xl"
                                  style={{
                                    height: 72,
                                    background: "rgba(99, 102, 241, 0.08)",
                                    border:
                                      "2px dashed rgba(99, 102, 241, 0.25)",
                                    transition: "height 0.2s ease",
                                  }}
                                />
                              )}

                            <div
                              ref={(el) => {
                                cardRefs.current[task.id] = el;
                              }}
                              onPointerDown={(e) =>
                                handleCardPointerDown(e, task, column)
                              }
                              className=""
                              style={{
                                cursor: "grab",
                                // Allow native vertical/horizontal scroll until long-press activates drag
                                touchAction: "pan-x pan-y",
                                WebkitUserSelect: "none",
                                userSelect: "none",
                                WebkitTouchCallout: "none",
                              }}
                            >
                              <LiquidGlassWrap
                                cornerRadius={16}
                                padding="14px 16px"
                                blurAmount={6}
                                overLight
                                elasticity={0.2}
                                shadowIntensity={0.8}
                              >
                                <TaskCardContent
                                  task={task}
                                  tagMap={tagMap}
                                  spaceMap={spaceMap}
                                  showSpacePill={activeSpaceId === ALL_SPACES}
                                />
                              </LiquidGlassWrap>
                            </div>
                          </Fragment>
                        );
                      })}

                      {/* Drop indicator at end of column */}
                      {isDropColumn &&
                        dropTarget.index === visibleTasks.length && (
                          <div
                            className="rounded-xl"
                            style={{
                              height: 72,
                              background: "rgba(99, 102, 241, 0.08)",
                              border: "2px dashed rgba(99, 102, 241, 0.25)",
                              transition: "height 0.2s ease",
                            }}
                          />
                        )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Rain overlay */}
      <RainOverlay active={rainActive} config={rainConfig} cardRefs={cardRefs} />

      {/* Manage spaces modal */}
      {user && (
        <ManageSpacesModal
          open={spacesModalOpen}
          onClose={() => setSpacesModalOpen(false)}
          ownerId={user.id}
          onSpacesChanged={handleSpacesChanged}
        />
      )}

      {/* Create / Edit task modal */}
      <GlassModal open={modalOpen} onClose={closeModal} width={840}>
        <h2
          className="text-xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-main, #fcfcfd)" }}
        >
          {isEditing ? "Edit Task" : "New Task"}
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
        >
          {isEditing ? "Update task details or delete it." : "Add a new task to the Backlog."}
        </p>

        <div className="flex flex-col gap-5">
          {/* Space + Tags row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-5">
            {/* Space selector */}
            <div>
              <label
                className="block text-xs font-bold uppercase tracking-widest mb-2"
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              >
                Space
              </label>
              <GlassDropdown
                size="sm"
                width={180}
                value={modalSpaceId}
                placeholder="Select a space..."
                options={spaces.map((s) => ({
                  id: s.id,
                  label: s.name + (s.is_default ? " ★" : ""),
                  icon: (
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: s.color,
                        boxShadow: `0 0 6px ${s.color}`,
                      }}
                    />
                  ),
                }))}
                onChange={(opt) => handleModalSpaceChange(opt.id)}
              />
            </div>

            {/* Tags */}
            <div className="flex-1 min-w-0">
              <label
                className="block text-xs font-bold uppercase tracking-widest mb-2"
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              >
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Selected tag chips */}
                {modalTags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer select-none"
                    style={{
                      background: "rgba(99, 102, 241, 0.45)",
                      border: "1px solid rgba(255,255,255,0.2)",
                    }}
                    onClick={() => handleRemoveTag(i)}
                  >
                    {tag}
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </span>
                ))}

                {/* Suggestions from the space's existing tag pool */}
                {modalSpaceId &&
                  modalSpaceTags
                    .filter((t) => !modalTags.includes(t.name))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleModalTag(tag.name)}
                        className="text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer select-none"
                        style={{
                          background: hexToRgba(tag.color || "#6366f1", 0.2),
                          border: "1px dashed rgba(255,255,255,0.2)",
                          color: "rgba(255,255,255,0.85)",
                        }}
                      >
                        + {tag.name}
                      </button>
                    ))}

                {/* Edit icon to toggle new tag input */}
                {modalSpaceId && (
                  <button
                    type="button"
                    onClick={() => setTagEditOpen((v) => !v)}
                    className="flex items-center justify-center rounded-full cursor-pointer select-none"
                    style={{
                      width: 28,
                      height: 28,
                      background: tagEditOpen
                        ? "rgba(99, 102, 241, 0.4)"
                        : "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      transition: "background 0.2s ease",
                    }}
                    title="Add new tag"
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
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {tagEditOpen ? (
                        <>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </>
                      ) : (
                        <>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </>
                      )}
                    </svg>
                  </button>
                )}

                {!modalSpaceId && modalTags.length === 0 && (
                  <span
                    className="text-xs italic"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    Select a space first
                  </span>
                )}
              </div>

              {/* Expandable new tag input */}
              {tagEditOpen && modalSpaceId && (
                <div className="mt-3">
                  <GlassFormField
                    placeholder="Type a new tag and press Enter..."
                    value={modalTagInput}
                    onChange={setModalTagInput}
                    onKeyDown={handleTagKeyDown}
                  />
                </div>
              )}
            </div>
          </div>

          <GlassFormField
            label="Title"
            placeholder="Task title..."
            value={modalTitle}
            onChange={setModalTitle}
            autoFocus
          />

          {/* Description */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
              }}
            >
              Description
            </label>
            <TiptapEditor
              content={modalDescription}
              onChange={setModalDescription}
            />
          </div>

          {/* ─── Recurring Task Section ─────────────── */}
          <div>
            <div className="flex items-center gap-3">
              <label
                className="text-xs font-bold uppercase tracking-widest"
                style={{
                  color: "rgba(255, 255, 255, 0.7)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              >
                Recurring Task
              </label>
              <TactileSwitch
                scale={0.45}
                checked={recurringEnabled}
                onChange={setRecurringEnabled}
              />
            </div>

            {recurringEnabled && (
              <div className="mt-4 flex flex-col gap-4">
                {/* Period selector */}
                <div>
                  <label
                    className="block text-xs font-bold uppercase tracking-widest mb-2"
                    style={{
                      color: "rgba(255, 255, 255, 0.5)",
                      textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    }}
                  >
                    Frequency
                  </label>
                  <SegmentControl
                    segments={["Daily", "Weekly", "Monthly"]}
                    activeIndex={["daily", "weekly", "monthly"].indexOf(recurringPeriod)}
                    onChange={(idx) => {
                      const periods = ["daily", "weekly", "monthly"] as const;
                      setRecurringPeriod(periods[idx]);
                      setRecurringDays([]);
                    }}
                  />
                </div>

                {/* Weekly day picker */}
                {recurringPeriod === "weekly" && (
                  <div>
                    <label
                      className="block text-xs font-bold uppercase tracking-widest mb-2"
                      style={{
                        color: "rgba(255, 255, 255, 0.5)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      Days of Week
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => {
                        const selected = recurringDays.includes(i);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setRecurringDays((prev) =>
                                selected ? prev.filter((d) => d !== i) : [...prev, i]
                              )
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-full cursor-pointer select-none"
                            style={{
                              background: selected
                                ? "rgba(99, 102, 241, 0.5)"
                                : "rgba(255, 255, 255, 0.08)",
                              border: selected
                                ? "1px solid rgba(99, 102, 241, 0.7)"
                                : "1px solid rgba(255,255,255,0.15)",
                              color: selected
                                ? "#fff"
                                : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Monthly date picker */}
                {recurringPeriod === "monthly" && (
                  <div>
                    <label
                      className="block text-xs font-bold uppercase tracking-widest mb-2"
                      style={{
                        color: "rgba(255, 255, 255, 0.5)",
                        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      Days of Month
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((date) => {
                        const selected = recurringDays.includes(date);
                        return (
                          <button
                            key={date}
                            type="button"
                            onClick={() =>
                              setRecurringDays((prev) =>
                                selected ? prev.filter((d) => d !== date) : [...prev, date]
                              )
                            }
                            className="text-xs font-bold rounded-lg cursor-pointer select-none"
                            style={{
                              width: 34,
                              height: 34,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: selected
                                ? "rgba(99, 102, 241, 0.5)"
                                : "rgba(255, 255, 255, 0.08)",
                              border: selected
                                ? "1px solid rgba(99, 102, 241, 0.7)"
                                : "1px solid rgba(255,255,255,0.1)",
                              color: selected
                                ? "#fff"
                                : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {date}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="sticky flex items-center -mx-8 -mb-8 px-8 pt-4 pb-8 mt-2"
            style={{
              bottom: "-2rem",
              background:
                "linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0.25) 60%, transparent)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              zIndex: 5,
            }}
          >
            {/* Delete button — only in edit mode */}
            {isEditing && (
              <GlassButton
                size="sm"
                tint="rgba(239, 68, 68, 0.3)"
                onClick={handleDeleteTask}
              >
                <span className="flex items-center gap-2">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  {deleting ? "Deleting..." : "Delete"}
                </span>
              </GlassButton>
            )}

            <div className="flex gap-3 ml-auto">
              <GlassButton size="sm" onClick={closeModal}>
                Cancel
              </GlassButton>
              <GlassButton
                size="sm"
                tint="rgba(99, 102, 241, 0.3)"
                onClick={handleSaveTask}
              >
                {saving
                  ? isEditing ? "Saving..." : "Creating..."
                  : isEditing ? "Save" : "Create Task"}
              </GlassButton>
            </div>
          </div>
        </div>
      </GlassModal>

      {/* Background gallery modal */}
      <BackgroundGalleryModal
        open={bgGalleryOpen}
        onClose={() => setBgGalleryOpen(false)}
        currentBackgroundId={activeBackground?.id ?? null}
        onSelect={async (bg) => {
          setActiveBackground(bg);
          setBgGalleryOpen(false);
          if (user) {
            await setUserBackground(user.id, bg?.id ?? null);
          }
        }}
      />

      {/* Rain settings modal */}
      <GlassModal open={rainModalOpen} onClose={() => setRainModalOpen(false)} width={360}>
        <div className="flex flex-col gap-6">
          {/* Header with toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-xl font-bold tracking-tight"
                style={{ color: "var(--text-main, #fcfcfd)" }}
              >
                Rain Effect
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
              >
                Make it Rain !
              </p>
            </div>
            <TactileSwitch
              checked={rainActive}
              onChange={setRainActive}
              scale={0.5}
            />
          </div>

          <div
            ref={rainSlidersRef}
            className="flex flex-col gap-6"
          >
            {/* Divider */}
            <div className="rain-slider-row" style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

            {/* Intensity */}
            <div className="rain-slider-row flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Intensity
              </span>
              <GlassSlider
                value={rainConfig.intensity}
                onChange={(v) => setRainConfig((prev) => ({ ...prev, intensity: v }))}
                min={1} max={3} step={1}
                showLabel
                formatLabel={(v) => ["Drizzle", "Moderate", "Downpour"][v - 1]}
                stepLabels={["Drizzle", "Moderate", "Downpour"]}
                scale={0.9}
              />
            </div>

            {/* Wind */}
            <div className="rain-slider-row flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Wind
              </span>
              <GlassSlider
                value={rainConfig.wind}
                onChange={(v) => setRainConfig((prev) => ({ ...prev, wind: v }))}
                min={-1} max={1} step={0.1}
                showLabel
                formatLabel={(v) => v === 0 ? "Calm" : v < 0 ? "Left" : "Right"}
                stepLabels={["Left", "Calm", "Right"]}
                scale={0.9}
              />
            </div>

            {/* Visibility */}
            <div className="rain-slider-row flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Visibility
              </span>
              <GlassSlider
                value={rainConfig.opacity}
                onChange={(v) => setRainConfig((prev) => ({ ...prev, opacity: v }))}
                min={0.1} max={1} step={0.05}
                showLabel
                formatLabel={(v) => `${Math.round(v * 100)}%`}
                stepLabels={["Subtle", "Full"]}
                scale={0.9}
              />
            </div>

            {/* Divider */}
            <div className="rain-slider-row" style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

            {/* Speed */}
            <div className="rain-slider-row flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Speed
              </span>
              <GlassSlider
                value={rainConfig.speed}
                onChange={(v) => setRainConfig((prev) => ({ ...prev, speed: v }))}
                min={1} max={3} step={1}
                showLabel
                formatLabel={(v) => ["Slow", "Medium", "Fast"][v - 1]}
                stepLabels={["Slow", "Medium", "Fast"]}
                scale={0.9}
              />
            </div>

            {/* Divider */}
            <div className="rain-slider-row" style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

            {/* Rain Sound Volume */}
            <div className="rain-slider-row flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                Rain Sound
              </span>
              <GlassSlider
                value={rainVolume}
                onChange={setRainVolume}
                min={0} max={1} step={0.05}
                showLabel
                formatLabel={(v) => `${Math.round(v * 100)}%`}
                stepLabels={["Mute", "Full"]}
                scale={0.9}
              />
            </div>
          </div>
        </div>
      </GlassModal>

      {/* Settings FAB — bottom left */}
      <LayeredFAB
        className="right-16"
        actions={[
          {
            id: "rain",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M8 19v1" /><path d="M8 14v1" />
                <path d="M16 19v1" /><path d="M16 14v1" />
                <path d="M12 21v1" /><path d="M12 16v1" />
              </svg>
            ),
            label: "Rain Effect",
            onClick: () => setRainModalOpen(true),
          },
          {
            id: "background",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            ),
            label: "Background Gallery",
            onClick: () => setBgGalleryOpen(true),
          },
          {
            id: "resync",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            ),
            label: "Re-Sync",
            onClick: loadData,
          },
          {
            id: "logout",
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            ),
            label: "Logout",
            onClick: logout,
          },
        ]}
      />
    </>
  );
}
