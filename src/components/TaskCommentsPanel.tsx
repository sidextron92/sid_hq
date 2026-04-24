"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import TiptapEditor from "@/components/TiptapEditor";
import { GlassButton } from "@/components/glass";
import {
  fetchTaskComments,
  createTaskComment,
  type PBTaskComment,
} from "@/lib/pocketbase";

// Hermes Agent user ID — comments posted by the AI agent are owned by this user
const HERMES_USER_ID = "rpb4ici3ll9e1mw";

// ─── Timestamp helper ──────────────────────────────
function formatRelative(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Avatar dot ───────────────────────────────────
function OwnerDot({ ownerId, isHermes }: { ownerId: string; isHermes: boolean }) {
  const initials = isHermes ? "H" : "U";
  const bg = isHermes ? "rgba(139, 92, 246, 0.7)" : "rgba(99, 102, 241, 0.6)";
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
      style={{
        width: 28,
        height: 28,
        background: bg,
        border: "1px solid rgba(255,255,255,0.2)",
        color: "#fff",
      }}
      title={isHermes ? "Hermes Agent" : ownerId}
    >
      {initials}
    </span>
  );
}

// ─── Single comment bubble ────────────────────────
function CommentBubble({ comment, currentUserId }: { comment: PBTaskComment; currentUserId: string }) {
  const isHermes = comment.owner === HERMES_USER_ID;
  const isMe = comment.owner === currentUserId;
  const authorLabel = isHermes ? "Hermes Agent" : isMe ? "You" : "User";
  const authorColor = isHermes
    ? "rgba(167,139,250,0.9)"
    : isMe
    ? "rgba(255,255,255,0.85)"
    : "rgba(134,239,172,0.85)"; // soft green for other users
  return (
    <div className="flex items-start gap-3">
      <OwnerDot ownerId={comment.owner} isHermes={isHermes} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className="text-xs font-bold"
            style={{ color: authorColor }}
          >
            {authorLabel}
          </span>
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            {formatRelative(comment.created)}
          </span>
        </div>
        <div
          className="tiptap-editor rounded-xl"
          style={{
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
            padding: "8px 12px",
          }}
        >
          {/* Render the HTML body read-only */}
          <div
            className="prose prose-invert max-w-none"
            style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.82)", userSelect: "text", cursor: "text" }}
            dangerouslySetInnerHTML={{ __html: comment.body }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────
interface TaskCommentsPanelProps {
  taskId: string;
  currentUserId: string;
  onCountChange?: (count: number) => void;
}

export default function TaskCommentsPanel({
  taskId,
  currentUserId,
  onCountChange,
}: TaskCommentsPanelProps) {
  const [comments, setComments] = useState<PBTaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [draftBody, setDraftBody] = useState("");
  const [posting, setPosting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  // Load comments when taskId changes
  useEffect(() => {
    if (!taskId) return;
    setLoadingComments(true);
    setComments([]);
    fetchTaskComments(taskId)
      .then((data) => {
        setComments(data);
      })
      .catch((err) => console.error("Failed to load comments:", err))
      .finally(() => setLoadingComments(false));
  }, [taskId]);

  // Scroll to bottom and sync count when comments change
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    onCountChangeRef.current?.(comments.length);
  }, [comments.length]);

  const isDraftEmpty = useCallback(() => {
    // Strip HTML tags; if nothing left it's empty
    if (!draftBody) return true;
    const text = draftBody.replace(/<[^>]*>/g, "").trim();
    return text.length === 0;
  }, [draftBody]);

  const handlePost = useCallback(async () => {
    if (isDraftEmpty() || posting) return;
    setPosting(true);
    try {
      const newComment = await createTaskComment({
        taskId,
        ownerId: currentUserId,
        body: draftBody,
      });
      setComments((prev) => [...prev, newComment]);
      // Reset draft — set to empty paragraph so TiptapEditor re-renders blank
      setDraftBody("");
    } catch (err) {
      console.error("Failed to post comment:", err);
    } finally {
      setPosting(false);
    }
  }, [isDraftEmpty, posting, taskId, currentUserId, draftBody]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Comment list ── */}
      <div
        className="flex flex-col gap-4 overflow-y-auto pr-1"
        style={{ maxHeight: 340, minHeight: 60 }}
      >
        {loadingComments ? (
          <p
            className="text-sm text-center py-6"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Loading comments...
          </p>
        ) : comments.length === 0 ? (
          <p
            className="text-sm text-center py-6"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            No comments yet. Be the first to add one.
          </p>
        ) : (
          comments.map((c) => <CommentBubble key={c.id} comment={c} currentUserId={currentUserId} />)
        )}
        <div ref={listEndRef} />
      </div>

      {/* ── Divider ── */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.07)",
          margin: "0 -2px",
        }}
      />

      {/* ── Compose area ── */}
      <div>
        <label
          className="block text-xs font-bold uppercase tracking-widest mb-2"
          style={{
            color: "rgba(255, 255, 255, 0.6)",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          Add a Comment
        </label>
        <TiptapEditor
          content={draftBody}
          onChange={setDraftBody}
        />
        <div className="flex justify-end mt-3">
          <GlassButton
            size="sm"
            tint="rgba(99, 102, 241, 0.3)"
            onClick={handlePost}
            disabled={posting || isDraftEmpty()}
          >
            {posting ? "Posting..." : "Post Comment"}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
