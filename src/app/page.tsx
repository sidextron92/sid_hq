"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  LiquidGlassWrap,
  GlassButton,
  GlassModal,
  GlassFormField,
  TactileSwitch,
  GlassSlider,
} from "@/components/glass";
import gsap from "gsap";
import { useAuth } from "@/context/AuthContext";
import RainOverlay, { type RainConfig } from "@/components/RainOverlay";
import {
  fetchTasks,
  fetchTags,
  createTask,
  updateTask,
  deleteTask,
  findOrCreateTag,
  reorderColumn,
  statusToColumn,
  columnToStatus,
  type PBTag,
} from "@/lib/pocketbase";

// ─── Types ──────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  tags: string[]; // tag record IDs
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
}: {
  task: Task;
  tagMap: Record<string, PBTag>;
}) {
  return (
    <>
      <h3 className="text-sm font-bold mb-2 break-words overflow-hidden">
        {task.title}
      </h3>
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

// ─── Component ──────────────────────────────────────
export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const emptyBoard: Board = { Backlog: [], "To Do": [], "In Progress": [], Done: [] };
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [tagMap, setTagMap] = useState<Record<string, PBTag>>({});
  const [loading, setLoading] = useState(true);

  // Unified modal state: null = closed, "new" = create, { task, column } = edit
  const [editingTask, setEditingTask] = useState<{ task: Task; column: string } | "new" | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalTagInput, setModalTagInput] = useState("");
  const [modalTags, setModalTags] = useState<string[]>([]); // tag names
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Rain overlay
  const [rainActive, setRainActive] = useState(false);
  const [rainConfig, setRainConfig] = useState<RainConfig>({
    intensity: 2, wind: 0.5, opacity: 0.7,
    splatterSize: 0.5, splatterParticleCount: 5, speedMin: 12, speedMax: 20, speed: 2,
  });
  const [rainModalOpen, setRainModalOpen] = useState(false);

  // ─── Redirect if not authenticated ─────────────
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  // ─── Load data from PocketBase ──────────────────
  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [tasks, tags] = await Promise.all([fetchTasks(user!.id), fetchTags(user!.id)]);

        // Build tag map
        const map: Record<string, PBTag> = {};
        for (const tag of tags) map[tag.id] = tag;
        setTagMap(map);

        // Build board from tasks
        const b: Board = { Backlog: [], "To Do": [], "In Progress": [], Done: [] };
        for (const task of tasks) {
          const col = statusToColumn(task.status);
          if (b[col]) {
            b[col].push({ id: task.id, title: task.title, tags: task.tags });
          }
        }
        setBoard(b);
      } catch (err) {
        console.error("Failed to load from PocketBase:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  // Drag state — only the dragged task id is in React state (for drop indicators)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    column: string;
    index: number;
  } | null>(null);

  // Refs
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
  } | null>(null);

  // Mirror state in refs for event handlers
  const boardRef = useRef(board);
  const dropTargetRef = useRef(dropTarget);
  const tagMapRef = useRef(tagMap);
  boardRef.current = board;
  dropTargetRef.current = dropTarget;
  tagMapRef.current = tagMap;

  // FLIP animation refs
  const animCardId = useRef<string | null>(null);
  const preDropRect = useRef<{ x: number; y: number } | null>(null);

  // Track whether pointer moved (to distinguish click from drag)
  const pointerMoved = useRef(false);

  // ─── Start drag ─────────────────────────────────
  const handleCardPointerDown = useCallback(
    (e: React.PointerEvent, task: Task, column: string) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();

      // Capture pointer on the element for reliable tracking
      el.setPointerCapture(e.pointerId);

      dragRef.current = {
        taskId: task.id,
        task,
        sourceColumn: column,
        el,
        placeholder: null!, // set after creation below
        originalParent: null!,
        originalNext: null,
        startRect: rect,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };

      setDraggedTaskId(task.id);
      pointerMoved.current = false;

      // Create a placeholder to hold the card's space in the column
      const placeholder = document.createElement("div");
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.transition = "height 0.2s ease";

      // Remember where the card was in the DOM
      const originalParent = el.parentElement!;
      const originalNext = el.nextSibling;

      // Store refs
      dragRef.current.placeholder = placeholder;
      dragRef.current.originalParent = originalParent;
      dragRef.current.originalNext = originalNext;

      // Insert placeholder and move card to body to escape overflow:hidden
      originalParent.insertBefore(placeholder, el);
      document.body.appendChild(el);

      // Position card fixed on screen at its original location
      el.style.willChange = "transform";
      el.style.position = "fixed";
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.width = `${rect.width}px`;
      el.style.zIndex = "200";
      el.style.pointerEvents = "none";
      el.style.margin = "0";

      gsap.to(el, {
        scale: 1.05,
        duration: 0.3,
        ease: "back.out(1.7)",
      });
    },
    []
  );

  // ─── Pointer move & up (document-level) ─────────
  useEffect(() => {
    if (!draggedTaskId) return;

    const handleMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      // Move the card (position: fixed, so set left/top directly)
      d.el.style.left = `${e.clientX - d.offsetX}px`;
      d.el.style.top = `${e.clientY - d.offsetY}px`;
      pointerMoved.current = true;

      // Find column under pointer
      let newDrop: { column: string; index: number } | null = null;

      for (const col of COLUMNS) {
        const colEl = columnRefs.current[col];
        if (!colEl) continue;
        const rect = colEl.getBoundingClientRect();

        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          const colTasks = boardRef.current[col].filter(
            (t) => t.id !== d.taskId
          );
          let insertIndex = colTasks.length;

          for (let i = 0; i < colTasks.length; i++) {
            const cardEl = cardRefs.current[colTasks[i].id];
            if (cardEl) {
              const cardRect = cardEl.getBoundingClientRect();
              if (e.clientY < cardRect.top + cardRect.height / 2) {
                insertIndex = i;
                break;
              }
            }
          }

          newDrop = { column: col, index: insertIndex };
          break;
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
    };

    const handleUp = () => {
      const d = dragRef.current;
      const dt = dropTargetRef.current;
      if (!d) return;

      // Record where the card currently is on screen
      const currentRect = d.el.getBoundingClientRect();
      preDropRect.current = { x: currentRect.left, y: currentRect.top };
      animCardId.current = d.taskId;

      // Return card to its original DOM position and remove placeholder
      gsap.set(d.el, { clearProps: "all" });
      d.el.style.position = "";
      d.el.style.left = "";
      d.el.style.top = "";
      d.el.style.width = "";
      d.el.style.zIndex = "";
      d.el.style.pointerEvents = "";
      d.el.style.margin = "";
      d.el.style.willChange = "";

      // Put card back into the DOM before React re-renders
      if (d.placeholder.parentElement) {
        d.placeholder.parentElement.insertBefore(d.el, d.placeholder);
        d.placeholder.remove();
      }

      // If pointer didn't move, treat as click → open edit modal
      if (!pointerMoved.current) {
        dragRef.current = null;
        setDraggedTaskId(null);
        setDropTarget(null);
        // Pre-populate form with existing task data
        setModalTitle(d.task.title);
        const taskTagNames = d.task.tags
          .map((id) => tagMapRef.current[id]?.name)
          .filter(Boolean) as string[];
        setModalTags(taskTagNames);
        setModalTagInput("");
        setEditingTask({ task: d.task, column: d.sourceColumn });
        return;
      }

      if (dt) {
        // Move task in board state
        setBoard((prev) => {
          const next: Board = {};
          for (const col of COLUMNS) {
            next[col] = prev[col].filter((t) => t.id !== d.taskId);
          }
          const target = [...next[dt.column]];
          target.splice(dt.index, 0, d.task);
          next[dt.column] = target;

          // Persist to PocketBase (fire-and-forget)
          reorderColumn(dt.column, target.map((t) => t.id)).catch((err) =>
            console.error("Failed to persist reorder:", err)
          );

          return next;
        });
      }

      // Clear drag state
      dragRef.current = null;
      setDraggedTaskId(null);
      setDropTarget(null);

      // FLIP: animate card from pre-drop screen position to new DOM position
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

          // Only animate if there's meaningful movement
          if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            gsap.fromTo(
              cardEl,
              { x: dx, y: dy, scale: 1.05 },
              {
                x: 0,
                y: 0,
                scale: 1,
                duration: 0.4,
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

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    };
  }, [!!draggedTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const closeModal = useCallback(() => {
    setEditingTask(null);
    setModalTitle("");
    setModalTags([]);
    setModalTagInput("");
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
    if (!modalTitle.trim() || saving) return;
    setSaving(true);

    try {
      // Resolve tag names to IDs (find or create)
      const resolvedTags = await Promise.all(
        modalTags.map((name) => findOrCreateTag(name, user!.id))
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
          tags: tagIds,
        });

        const updatedTask: Task = {
          id: task.id,
          title: modalTitle.trim(),
          tags: tagIds,
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
          status: "backlog",
          tags: tagIds,
          sort_order: backlogCount + 1,
          owner: user!.id,
        });

        const task: Task = {
          id: pbTask.id,
          title: pbTask.title,
          tags: pbTask.tags,
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
  }, [modalTitle, modalTags, saving, isEditing, editingTask, board.Backlog.length, closeModal]);

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

  // ─── Render ─────────────────────────────────────
  if (authLoading || !user) return null;

  return (
    <>
      <div className="h-screen bg-background relative overflow-hidden flex flex-col">
        {/* Video background */}
        <video
          className="absolute inset-0 z-0 w-full h-full object-cover"
          src="/background.webm"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Dim overlay for readability */}
        <div
          className="absolute inset-0 z-0"
          style={{ background: "rgba(0, 0, 0, 0.1)" }}
        />

        {/* Header */}
        <header className="relative z-10 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
            Control Centre
          </h1>
          <div className="flex items-center gap-3">
            {/* Rain settings */}
            <GlassButton
              size="sm"
              tint={rainActive ? "rgba(99, 162, 241, 0.3)" : undefined}
              onClick={() => setRainModalOpen(true)}
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
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M8 19v1" />
                  <path d="M8 14v1" />
                  <path d="M16 19v1" />
                  <path d="M16 14v1" />
                  <path d="M12 21v1" />
                  <path d="M12 16v1" />
                </svg>
                Rain
              </span>
            </GlassButton>

            <GlassButton onClick={() => {
              setModalTitle("");
              setModalTags([]);
              setModalTagInput("");
              setEditingTask("new");
            }}>
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
                Add Task
              </span>
            </GlassButton>
            <GlassButton size="sm" onClick={logout}>
              <span className="flex items-center gap-2">
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
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </span>
            </GlassButton>
          </div>
        </header>

        {/* Kanban board */}
        <main className="relative z-10 flex-1 px-4 sm:px-8 pb-8 overflow-x-auto overflow-y-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
                Loading tasks...
              </p>
            </div>
          )}
          <div className="flex gap-5 h-full" style={{ display: loading ? "none" : undefined }}>
            {COLUMNS.map((column) => {
              const tasks = board[column];
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
                  className="flex flex-col h-full rounded-2xl overflow-hidden min-w-[220px] flex-1"
                  style={{
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    background: "rgba(0, 0, 0, 0.1)",
                    willChange: "transform, box-shadow",
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
                                touchAction: "none",
                              }}
                            >
                              <LiquidGlassWrap
                                cornerRadius={16}
                                padding="14px 16px"
                                blurAmount={6}
                                displacementScale={60}
                                overLight
                                elasticity={0.2}
                                shadowIntensity={0.8}
                              >
                                <TaskCardContent task={task} tagMap={tagMap} />
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

      {/* Create / Edit task modal */}
      <GlassModal open={modalOpen} onClose={closeModal}>
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
          <GlassFormField
            label="Title"
            placeholder="Task title..."
            value={modalTitle}
            onChange={setModalTitle}
          />

          {/* Tags */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "rgba(255, 255, 255, 0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              Tags
            </label>

            {modalTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {modalTags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer select-none"
                    style={{
                      background: "rgba(99, 102, 241, 0.35)",
                      border: "1px solid rgba(255,255,255,0.15)",
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
              </div>
            )}

            <GlassFormField
              placeholder="Type a tag and press Enter..."
              value={modalTagInput}
              onChange={setModalTagInput}
              onKeyDown={handleTagKeyDown}
            />
          </div>

          <div className="flex items-center mt-2">
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
                {rainActive ? "Rain is falling" : "Rain is paused"}
              </p>
            </div>
            <TactileSwitch
              checked={rainActive}
              onChange={setRainActive}
              scale={0.5}
            />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

          {/* Intensity */}
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />

          {/* Speed */}
          <div className="flex flex-col gap-2">
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
        </div>
      </GlassModal>
    </>
  );
}
