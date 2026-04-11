"use client";

import { useState, useCallback, useEffect } from "react";
import { GlassModal, GlassButton, GlassFormField } from "@/components/glass";
import {
  fetchSpaces,
  createSpace,
  updateSpace,
  setDefaultSpace,
  deleteSpace,
  countTasksInSpace,
  type PBSpace,
} from "@/lib/pocketbase";

const SWATCHES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#22c55e", "#14b8a6", "#06b6d4",
];

interface Props {
  open: boolean;
  onClose: () => void;
  ownerId: string;
  onSpacesChanged: (spaces: PBSpace[]) => void;
}

export default function ManageSpacesModal({
  open,
  onClose,
  ownerId,
  onSpacesChanged,
}: Props) {
  const [spaces, setSpaces] = useState<PBSpace[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(SWATCHES[0]);
  const [pendingDelete, setPendingDelete] = useState<{
    space: PBSpace;
    taskCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSpaces(ownerId);
      setSpaces(list);
      onSpacesChanged(list);
    } finally {
      setLoading(false);
    }
  }, [ownerId, onSpacesChanged]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await createSpace({
        name: newName.trim(),
        ownerId,
        color: newColor,
        makeDefault: spaces.length === 0,
      });
      setNewName("");
      setNewColor(SWATCHES[Math.floor(Math.random() * SWATCHES.length)]);
      await reload();
    } finally {
      setBusy(false);
    }
  }, [newName, newColor, ownerId, spaces.length, busy, reload]);

  const beginEdit = useCallback((s: PBSpace) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editName.trim() || busy) return;
    setBusy(true);
    try {
      await updateSpace(editingId, { name: editName.trim(), color: editColor });
      cancelEdit();
      await reload();
    } finally {
      setBusy(false);
    }
  }, [editingId, editName, editColor, busy, cancelEdit, reload]);

  const handleSetDefault = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      try {
        await setDefaultSpace(id, ownerId);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [ownerId, busy, reload]
  );

  const requestDelete = useCallback(
    async (s: PBSpace) => {
      if (spaces.length <= 1) return; // block deleting last space
      const count = await countTasksInSpace(s.id, ownerId);
      setPendingDelete({ space: s, taskCount: count });
    },
    [spaces.length, ownerId]
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    try {
      await deleteSpace(pendingDelete.space.id, ownerId);
      setPendingDelete(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, ownerId, busy, reload]);

  return (
    <>
      <GlassModal open={open} onClose={onClose} width={460}>
        <h2
          className="text-xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-main, #fcfcfd)" }}
        >
          Manage Spaces
        </h2>
        <p
          className="text-sm mb-6"
          style={{
            color: "rgba(255, 255, 255, 0.7)",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          Organize tasks into spaces. Each space has its own tags.
        </p>

        {/* Existing spaces */}
        <div className="flex flex-col gap-2 mb-6 max-h-[40vh] overflow-y-auto pr-1">
          {loading && (
            <p
              className="text-xs"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Loading...
            </p>
          )}
          {!loading &&
            spaces.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className="p-2 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-3 p-1">
                      {/* Row 1 — name input */}
                      <div>
                        <label
                          className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                          }}
                        >
                          Name
                        </label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                          className="w-full bg-transparent outline-none text-sm font-bold px-3 py-2 rounded-lg"
                          style={{
                            color: "#fff",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.25)",
                          }}
                        />
                      </div>

                      {/* Row 2 — color swatches */}
                      <div>
                        <label
                          className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                          style={{
                            color: "rgba(255,255,255,0.6)",
                            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                          }}
                        >
                          Color
                        </label>
                        <div className="flex gap-1.5 flex-wrap">
                          {SWATCHES.map((c) => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className="w-6 h-6 rounded-full cursor-pointer"
                              style={{
                                background: c,
                                border:
                                  editColor === c
                                    ? "2px solid #fff"
                                    : "1px solid rgba(255,255,255,0.2)",
                                boxShadow:
                                  editColor === c ? `0 0 8px ${c}` : undefined,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Row 3 — actions */}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#fff",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                          style={{
                            background: "rgba(99,102,241,0.45)",
                            border: "1px solid rgba(99,102,241,0.6)",
                            color: "#fff",
                          }}
                        >
                          {busy ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Default star */}
                      <button
                        onClick={() => handleSetDefault(s.id)}
                        title={s.is_default ? "Default space" : "Set as default"}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer"
                        style={{
                          color: s.is_default
                            ? "#facc15"
                            : "rgba(255,255,255,0.35)",
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill={s.is_default ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          background: s.color,
                          boxShadow: `0 0 8px ${s.color}80`,
                        }}
                      />
                      <span
                        className="flex-1 text-sm font-bold truncate"
                        style={{ color: "#fff" }}
                      >
                        {s.name}
                      </span>
                      <button
                        onClick={() => beginEdit(s)}
                        title="Rename"
                        className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
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
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => requestDelete(s)}
                        disabled={spaces.length <= 1}
                        title={
                          spaces.length <= 1
                            ? "Cannot delete the only space"
                            : "Delete space"
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-full cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: "rgba(239, 68, 68, 0.7)" }}
                      >
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
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Add new space */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.12)",
          }}
        >
          <label
            className="block text-xs font-bold uppercase tracking-widest mb-2"
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            New Space
          </label>
          <GlassFormField
            placeholder="e.g. Work, Personal..."
            value={newName}
            onChange={setNewName}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className="w-6 h-6 rounded-full cursor-pointer"
                  style={{
                    background: c,
                    border:
                      newColor === c
                        ? "2px solid #fff"
                        : "1px solid rgba(255,255,255,0.2)",
                    boxShadow:
                      newColor === c ? `0 0 8px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
            <GlassButton
              size="sm"
              tint="rgba(99, 102, 241, 0.3)"
              onClick={handleCreate}
            >
              {busy ? "Adding..." : "Add Space"}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Confirm delete modal */}
      <GlassModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        width={400}
      >
        <h2
          className="text-xl font-bold tracking-tight mb-3"
          style={{ color: "#fcfcfd" }}
        >
          Delete space?
        </h2>
        {pendingDelete && (
          <p
            className="text-sm mb-6"
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            This will permanently delete the space{" "}
            <strong style={{ color: "#fff" }}>{pendingDelete.space.name}</strong>
            {pendingDelete.taskCount > 0 ? (
              <>
                {" "}
                along with{" "}
                <strong style={{ color: "#fca5a5" }}>
                  {pendingDelete.taskCount} task
                  {pendingDelete.taskCount === 1 ? "" : "s"}
                </strong>{" "}
                and all its tags.
              </>
            ) : (
              <> and all its tags.</>
            )}{" "}
            This cannot be undone.
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <GlassButton size="sm" onClick={() => setPendingDelete(null)}>
            Cancel
          </GlassButton>
          <GlassButton
            size="sm"
            tint="rgba(239, 68, 68, 0.4)"
            onClick={confirmDelete}
          >
            {busy ? "Deleting..." : "Delete"}
          </GlassButton>
        </div>
      </GlassModal>
    </>
  );
}
