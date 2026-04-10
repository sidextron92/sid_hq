import PocketBase, { RecordModel } from "pocketbase";

const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);

// Disable auto-cancellation so concurrent requests don't cancel each other
pb.autoCancellation(false);

// ─── Types ──────────────────────────────────────────
export interface PBTag {
  id: string;
  name: string;
  color: string;
}

export interface PBTask {
  id: string;
  title: string;
  status: string;
  tags: string[]; // tag record IDs
  sort_order: number;
  is_deleted: boolean;
}

// Status ↔ Column mapping
const STATUS_TO_COLUMN: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const COLUMN_TO_STATUS: Record<string, string> = {
  Backlog: "backlog",
  "To Do": "todo",
  "In Progress": "in_progress",
  Done: "done",
};

export function statusToColumn(status: string): string {
  return STATUS_TO_COLUMN[status] ?? "Backlog";
}

export function columnToStatus(column: string): string {
  return COLUMN_TO_STATUS[column] ?? "backlog";
}

// ─── Tags ───────────────────────────────────────────
export async function fetchTags(ownerId: string): Promise<PBTag[]> {
  const records = await pb.collection("tags").getFullList<RecordModel>({
    sort: "name",
    filter: `owner = "${ownerId}"`,
  });
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
  }));
}

export async function findOrCreateTag(name: string, ownerId: string): Promise<PBTag> {
  // Try to find existing tag by name for this owner
  try {
    const existing = await pb.collection("tags").getFirstListItem<RecordModel>(
      `name="${name}" && owner="${ownerId}"`
    );
    return { id: existing.id, name: existing.name, color: existing.color };
  } catch {
    // Not found — create it with a default color
    const defaultColors = ["#8b5cf6", "#06b6d4", "#22c55e", "#f43f5e", "#f59e0b", "#ec4899", "#14b8a6", "#6366f1"];
    const hash = Array.from(name).reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0);
    const color = defaultColors[Math.abs(hash) % defaultColors.length];
    const created = await pb.collection("tags").create<RecordModel>({ name, color, owner: ownerId });
    return { id: created.id, name: created.name, color: created.color };
  }
}

// ─── Tasks ──────────────────────────────────────────
export async function fetchTasks(ownerId: string): Promise<PBTask[]> {
  const records = await pb.collection("tasks").getFullList<RecordModel>({
    sort: "sort_order",
    filter: `is_deleted = false && owner = "${ownerId}"`,
  });
  return records.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    tags: r.tags ?? [],
    sort_order: r.sort_order ?? 0,
    is_deleted: r.is_deleted ?? false,
  }));
}

export async function createTask(data: {
  title: string;
  status: string;
  tags: string[]; // tag IDs
  sort_order: number;
  owner: string;
}): Promise<PBTask> {
  const record = await pb.collection("tasks").create<RecordModel>({
    ...data,
    is_deleted: false,
  });
  return {
    id: record.id,
    title: record.title,
    status: record.status,
    tags: record.tags ?? [],
    sort_order: record.sort_order ?? 0,
    is_deleted: false,
  };
}

export async function updateTask(
  id: string,
  data: Partial<{ title: string; status: string; tags: string[]; sort_order: number }>
): Promise<void> {
  await pb.collection("tasks").update(id, data);
}

export async function deleteTask(id: string): Promise<void> {
  await pb.collection("tasks").update(id, { is_deleted: true });
}

// ─── Bulk update sort orders after drag ─────────────
export async function reorderColumn(
  column: string,
  taskIds: string[]
): Promise<void> {
  const status = columnToStatus(column);
  await Promise.all(
    taskIds.map((id, index) =>
      pb.collection("tasks").update(id, { status, sort_order: index + 1 })
    )
  );
}

export default pb;
