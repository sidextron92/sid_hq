"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import {
  LiquidGlassWrap,
  GlassButton,
  GlassModal,
  GlassFormField,
} from "@/components/glass";
import gsap from "gsap";

// ─── Types ──────────────────────────────────────────
interface Task {
  id: string;
  title: string;
  tags: string[];
}

type Board = Record<string, Task[]>;

const COLUMNS = ["Backlog", "To Do", "In Progress", "Done"];

const initialBoard: Board = {
  Backlog: [
    { id: "1", title: "Research competitors", tags: ["research"] },
    { id: "2", title: "Define API schema", tags: ["backend", "api"] },
  ],
  "To Do": [
    { id: "3", title: "Design landing page", tags: ["design", "ui"] },
    { id: "4", title: "Setup CI/CD pipeline", tags: ["devops"] },
  ],
  "In Progress": [
    { id: "5", title: "Build auth module", tags: ["backend", "auth"] },
  ],
  Done: [
    { id: "6", title: "Project kickoff", tags: ["planning"] },
  ],
};

let nextId = 7;

// ─── Tag colors ─────────────────────────────────────
const TAG_COLORS = [
  "rgba(99, 102, 241, 0.35)",
  "rgba(236, 72, 153, 0.35)",
  "rgba(20, 184, 166, 0.35)",
  "rgba(245, 158, 11, 0.35)",
  "rgba(139, 92, 246, 0.35)",
  "rgba(6, 182, 212, 0.35)",
  "rgba(34, 197, 94, 0.35)",
  "rgba(239, 68, 68, 0.35)",
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ─── Task card content ──────────────────────────────
function TaskCardContent({ task }: { task: Task }) {
  return (
    <>
      <h3 className="text-sm font-bold mb-2">{task.title}</h3>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: getTagColor(tag),
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Component ──────────────────────────────────────
export default function Home() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);

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
  boardRef.current = board;
  dropTargetRef.current = dropTarget;

  // FLIP animation refs
  const animCardId = useRef<string | null>(null);
  const preDropRect = useRef<{ x: number; y: number } | null>(null);

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

      // Put card back into the DOM before React re-renders
      if (d.placeholder.parentElement) {
        d.placeholder.parentElement.insertBefore(d.el, d.placeholder);
        d.placeholder.remove();
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

  // ─── Add task ───────────────────────────────────
  const handleAddTask = useCallback(() => {
    if (!newTitle.trim()) return;
    const task: Task = {
      id: String(nextId++),
      title: newTitle.trim(),
      tags: newTags,
    };
    setBoard((prev) => ({
      ...prev,
      Backlog: [...prev.Backlog, task],
    }));
    setNewTitle("");
    setNewTags([]);
    setNewTagInput("");
    setModalOpen(false);
  }, [newTitle, newTags]);

  const handleRemoveTag = useCallback((index: number) => {
    setNewTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === "Enter" || e.key === ",") && newTagInput.trim()) {
        e.preventDefault();
        setNewTags((prev) => [...prev, newTagInput.trim()]);
        setNewTagInput("");
      }
      if (e.key === "Backspace" && !newTagInput && newTags.length > 0) {
        setNewTags((prev) => prev.slice(0, -1));
      }
    },
    [newTagInput, newTags.length]
  );

  // ─── Render ─────────────────────────────────────
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
          style={{ background: "rgba(0, 0, 0, 0.35)" }}
        />

        {/* Header */}
        <header className="relative z-10 px-8 pt-8 pb-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Control Centre
          </h1>
          <GlassButton onClick={() => setModalOpen(true)}>
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
        </header>

        {/* Kanban board */}
        <main className="relative z-10 flex-1 px-8 pb-8 overflow-hidden">
          <div className="grid grid-cols-4 gap-5 h-full">
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
                  className="flex flex-col h-full rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    background: "rgba(0, 0, 0, 0.2)",
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
                            color: "var(--text-muted)",
                          }}
                        >
                          {tasks.length}
                        </span>
                      </div>
                    </LiquidGlassWrap>
                  </div>

                  {/* Cards area */}
                  <div className="flex-1 overflow-y-auto px-3 pb-3">
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
                              style={{
                                cursor: "grab",
                                willChange: "transform",
                                touchAction: "none",
                              }}
                            >
                              <LiquidGlassWrap
                                cornerRadius={16}
                                padding="14px 16px"
                                blurAmount={10}
                                displacementScale={60}
                                elasticity={0.2}
                                shadowIntensity={0.8}
                              >
                                <TaskCardContent task={task} />
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

      {/* Add task modal */}
      <GlassModal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h2
          className="text-xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-main, #fcfcfd)" }}
        >
          New Task
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: "var(--text-muted, #8a8a98)" }}
        >
          Add a new task to the Backlog.
        </p>

        <div className="flex flex-col gap-5">
          <GlassFormField
            label="Title"
            placeholder="Task title..."
            value={newTitle}
            onChange={setNewTitle}
          />

          {/* Tags */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--text-muted, #8a8a98)" }}
            >
              Tags
            </label>

            {newTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {newTags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer select-none"
                    style={{
                      background: getTagColor(tag),
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
              value={newTagInput}
              onChange={setNewTagInput}
              onKeyDown={handleTagKeyDown}
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <GlassButton
              size="sm"
              onClick={() => {
                setModalOpen(false);
                setNewTitle("");
                setNewTags([]);
                setNewTagInput("");
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton
              size="sm"
              tint="rgba(99, 102, 241, 0.3)"
              onClick={handleAddTask}
            >
              Create Task
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </>
  );
}
