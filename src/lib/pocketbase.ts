import PocketBase, { RecordModel } from "pocketbase";

// Use same-origin proxy in the browser so the service worker can cache requests.
// On the server (SSR) fall back to the direct PocketBase URL.
const pbUrl =
  typeof window !== "undefined"
    ? "/pb"
    : process.env.NEXT_PUBLIC_POCKETBASE_URL;

const pb = new PocketBase(pbUrl);

// Disable auto-cancellation so concurrent requests don't cancel each other
pb.autoCancellation(false);

// ─── Types ──────────────────────────────────────────
export interface PBSpace {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
}

export interface PBTag {
  id: string;
  name: string;
  color: string;
  space: string; // space id
  created: string;
  updated: string;
}

export interface PBTask {
  id: string;
  title: string;
  description: string;
  status: string;
  tags: string[]; // tag record IDs
  space: string; // space id
  sort_order: number;
  is_deleted: boolean;
  recurring_job_id: string; // recurring_jobs relation (empty if none)
  created: string;
  updated: string;
}

export interface PBRecurringJob {
  id: string;
  owner: string;
  template_task_id: string;
  period: "daily" | "weekly" | "monthly";
  days: number[] | null; // monthly: [1,15], weekly: [0-6], daily: null
  is_active: boolean;
  last_executed_at: string; // ISO date or ""
  is_deleted: boolean;
  created: string;
  updated: string;
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

// ─── Spaces ─────────────────────────────────────────
const DEFAULT_SPACE_COLORS = [
  "#8b5cf6", "#06b6d4", "#22c55e", "#f43f5e",
  "#f59e0b", "#ec4899", "#14b8a6", "#6366f1",
];

export async function fetchSpaces(ownerId: string): Promise<PBSpace[]> {
  const records = await pb.collection("spaces").getFullList<RecordModel>({
    sort: "-is_default,name",
    filter: `owner = "${ownerId}"`,
  });
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color || DEFAULT_SPACE_COLORS[0],
    is_default: r.is_default ?? false,
  }));
}

export async function createSpace(data: {
  name: string;
  ownerId: string;
  color?: string;
  makeDefault?: boolean;
}): Promise<PBSpace> {
  // If makeDefault, clear other defaults first
  if (data.makeDefault) {
    const existing = await pb.collection("spaces").getFullList<RecordModel>({
      filter: `owner = "${data.ownerId}" && is_default = true`,
    });
    await Promise.all(
      existing.map((r) => pb.collection("spaces").update(r.id, { is_default: false }))
    );
  }

  const color =
    data.color ||
    DEFAULT_SPACE_COLORS[Math.floor(Math.random() * DEFAULT_SPACE_COLORS.length)];

  const record = await pb.collection("spaces").create<RecordModel>({
    name: data.name,
    color,
    is_default: data.makeDefault ?? false,
    owner: data.ownerId,
  });

  return {
    id: record.id,
    name: record.name,
    color: record.color,
    is_default: record.is_default ?? false,
  };
}

export async function updateSpace(
  id: string,
  data: Partial<{ name: string; color: string }>
): Promise<void> {
  await pb.collection("spaces").update(id, data);
}

export async function setDefaultSpace(spaceId: string, ownerId: string): Promise<void> {
  // Clear all other defaults for this owner
  const others = await pb.collection("spaces").getFullList<RecordModel>({
    filter: `owner = "${ownerId}" && id != "${spaceId}" && is_default = true`,
  });
  await Promise.all(
    others.map((r) => pb.collection("spaces").update(r.id, { is_default: false }))
  );
  await pb.collection("spaces").update(spaceId, { is_default: true });
}

/**
 * Delete a space and cascade-delete all its tasks and tags.
 * Soft-deletes tasks (is_deleted = true); hard-deletes tags and space record.
 */
export async function deleteSpace(spaceId: string, ownerId: string): Promise<void> {
  // Soft-delete all tasks in this space
  const tasks = await pb.collection("tasks").getFullList<RecordModel>({
    filter: `space = "${spaceId}" && owner = "${ownerId}" && is_deleted = false`,
  });
  await Promise.all(
    tasks.map((r) => pb.collection("tasks").update(r.id, { is_deleted: true }))
  );

  // Hard-delete all tags in this space
  const tags = await pb.collection("tags").getFullList<RecordModel>({
    filter: `space = "${spaceId}" && owner = "${ownerId}"`,
  });
  await Promise.all(tags.map((r) => pb.collection("tags").delete(r.id)));

  // Delete space
  await pb.collection("spaces").delete(spaceId);
}

export async function countTasksInSpace(spaceId: string, ownerId: string): Promise<number> {
  const list = await pb.collection("tasks").getList(1, 1, {
    filter: `space = "${spaceId}" && owner = "${ownerId}" && is_deleted = false`,
  });
  return list.totalItems;
}

/**
 * Ensure the user has at least one space. If none exist, create "General" as default
 * and backfill any existing tags/tasks (rows without a space field) to it.
 * Safe to call on every app load — exits early if a space already exists.
 */
export async function ensureDefaultSpace(ownerId: string): Promise<PBSpace> {
  const existing = await fetchSpaces(ownerId);
  if (existing.length > 0) {
    // Ensure at least one is marked default
    if (!existing.some((s) => s.is_default)) {
      await setDefaultSpace(existing[0].id, ownerId);
      existing[0].is_default = true;
    }
    return existing.find((s) => s.is_default) || existing[0];
  }

  // Create General space
  const general = await createSpace({
    name: "General",
    ownerId,
    color: "#6366f1",
    makeDefault: true,
  });

  // Backfill existing orphan tags (space empty)
  try {
    const orphanTags = await pb.collection("tags").getFullList<RecordModel>({
      filter: `owner = "${ownerId}" && space = ""`,
    });
    await Promise.all(
      orphanTags.map((r) => pb.collection("tags").update(r.id, { space: general.id }))
    );
    if (orphanTags.length > 0) {
      console.log(`✅ tag backfill complete (${orphanTags.length} tags)`);
    }
  } catch (err) {
    console.warn("Tag backfill skipped:", err);
  }

  // Backfill existing orphan tasks (space empty)
  try {
    const orphanTasks = await pb.collection("tasks").getFullList<RecordModel>({
      filter: `owner = "${ownerId}" && space = ""`,
    });
    await Promise.all(
      orphanTasks.map((r) => pb.collection("tasks").update(r.id, { space: general.id }))
    );
    if (orphanTasks.length > 0) {
      console.log(`✅ task backfill complete (${orphanTasks.length} tasks)`);
    }
  } catch (err) {
    console.warn("Task backfill skipped:", err);
  }

  return general;
}

// ─── Tags ───────────────────────────────────────────
export async function fetchTags(ownerId: string, spaceId?: string): Promise<PBTag[]> {
  const filter = spaceId
    ? pb.filter("owner = {:owner} && space = {:space}", {
        owner: ownerId,
        space: spaceId,
      })
    : pb.filter("owner = {:owner}", { owner: ownerId });
  const records = await pb.collection("tags").getFullList<RecordModel>({
    sort: "name",
    filter,
    fields: "id,name,color,space,created,updated,owner",
  });
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    space: r.space || "",
    created: r.created,
    updated: r.updated,
  }));
}

export async function findOrCreateTag(
  name: string,
  ownerId: string,
  spaceId: string
): Promise<PBTag> {
  // Try to find existing tag by (name, space) for this owner
  try {
    const existing = await pb.collection("tags").getFirstListItem<RecordModel>(
      `name="${name}" && owner="${ownerId}" && space="${spaceId}"`
    );
    return {
      id: existing.id,
      name: existing.name,
      color: existing.color,
      space: existing.space || "",
      created: existing.created,
      updated: existing.updated,
    };
  } catch {
    // Not found — create it with a deterministic color
    const hash = Array.from(name).reduce(
      (h, c) => c.charCodeAt(0) + ((h << 5) - h),
      0
    );
    const color = DEFAULT_SPACE_COLORS[Math.abs(hash) % DEFAULT_SPACE_COLORS.length];
    const created = await pb.collection("tags").create<RecordModel>({
      name,
      color,
      owner: ownerId,
      space: spaceId,
    });
    return {
      id: created.id,
      name: created.name,
      color: created.color,
      space: created.space || "",
      created: created.created,
      updated: created.updated,
    };
  }
}

// ─── Tasks ──────────────────────────────────────────
export async function fetchTasks(ownerId: string, spaceId?: string): Promise<PBTask[]> {
  const filter = spaceId
    ? `is_deleted = false && owner = "${ownerId}" && space = "${spaceId}"`
    : `is_deleted = false && owner = "${ownerId}"`;
  const records = await pb.collection("tasks").getFullList<RecordModel>({
    sort: "sort_order",
    filter,
    fields: "id,title,description,status,tags,space,sort_order,is_deleted,recurring_job_id,created,updated,owner",
  });
  return records.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    status: r.status,
    tags: r.tags ?? [],
    space: r.space || "",
    sort_order: r.sort_order ?? 0,
    is_deleted: r.is_deleted ?? false,
    recurring_job_id: r.recurring_job_id || "",
    created: r.created,
    updated: r.updated,
  }));
}

export async function createTask(data: {
  title: string;
  description?: string;
  status: string;
  tags: string[]; // tag IDs
  space: string;
  sort_order: number;
  owner: string;
  recurring_job_id?: string;
}): Promise<PBTask> {
  const record = await pb.collection("tasks").create<RecordModel>({
    ...data,
    description: data.description ?? "",
    is_deleted: false,
  });
  return {
    id: record.id,
    title: record.title,
    description: record.description ?? "",
    status: record.status,
    tags: record.tags ?? [],
    space: record.space || "",
    sort_order: record.sort_order ?? 0,
    is_deleted: false,
    recurring_job_id: record.recurring_job_id || "",
    created: record.created,
    updated: record.updated,
  };
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    status: string;
    tags: string[];
    space: string;
    sort_order: number;
  }>
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

// ─── Backgrounds ───────────────────────────────────
export interface PBBackground {
  id: string;
  name: string;
  type: "image" | "video";
  fileUrl: string;
  thumbnailUrl: string;
}

export async function fetchBackgrounds(): Promise<PBBackground[]> {
  const records = await pb.collection("backgrounds").getFullList<RecordModel>({
    sort: "sort_order",
  });
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as "image" | "video",
    fileUrl: pb.files.getURL(r, r.file),
    thumbnailUrl: pb.files.getURL(r, r.thumbnail),
  }));
}

export async function getUserBackground(userId: string): Promise<PBBackground | null> {
  const record = await pb.collection("users").getOne<RecordModel>(userId, {
    expand: "selected_background",
  });
  const bg = record.expand?.selected_background as RecordModel | undefined;
  if (!bg) return null;
  return {
    id: bg.id,
    name: bg.name,
    type: bg.type as "image" | "video",
    fileUrl: pb.files.getURL(bg, bg.file),
    thumbnailUrl: pb.files.getURL(bg, bg.thumbnail),
  };
}

export async function setUserBackground(
  userId: string,
  backgroundId: string | null
): Promise<void> {
  await pb.collection("users").update(userId, {
    selected_background: backgroundId ?? "",
  });
}

// ─── Recurring Jobs ────────────────────────────────
function mapRecurringJob(r: RecordModel): PBRecurringJob {
  return {
    id: r.id,
    owner: r.owner,
    template_task_id: r.template_task_id,
    period: r.period as PBRecurringJob["period"],
    days: r.days ?? null,
    is_active: r.is_active ?? true,
    last_executed_at: r.last_executed_at || "",
    is_deleted: r.is_deleted ?? false,
    created: r.created,
    updated: r.updated,
  };
}

export async function createRecurringJob(data: {
  owner: string;
  template_task_id: string;
  period: "daily" | "weekly" | "monthly";
  days: number[] | null;
}): Promise<PBRecurringJob> {
  const record = await pb.collection("recurring_jobs").create<RecordModel>({
    ...data,
    is_active: true,
    last_executed_at: "",
    is_deleted: false,
  });
  return mapRecurringJob(record);
}

export async function updateRecurringJob(
  id: string,
  data: Partial<{
    period: "daily" | "weekly" | "monthly";
    days: number[] | null;
    is_active: boolean;
  }>
): Promise<void> {
  await pb.collection("recurring_jobs").update(id, data);
}

export async function deleteRecurringJob(id: string): Promise<void> {
  await pb.collection("recurring_jobs").update(id, { is_deleted: true, is_active: false });
}

export async function fetchRecurringJobForTask(taskId: string): Promise<PBRecurringJob | null> {
  try {
    const record = await pb
      .collection("recurring_jobs")
      .getFirstListItem<RecordModel>(
        `template_task_id = "${taskId}" && is_deleted = false`
      );
    return mapRecurringJob(record);
  } catch {
    return null;
  }
}

export async function fetchRecurringJobById(id: string): Promise<PBRecurringJob | null> {
  try {
    const record = await pb.collection("recurring_jobs").getOne<RecordModel>(id);
    if (record.is_deleted) return null;
    return mapRecurringJob(record);
  } catch {
    return null;
  }
}

export default pb;
