#!/usr/bin/env node

/**
 * Cron job for recurring tasks.
 * Run daily at 6 AM: 0 6 * * * node /path/to/scripts/cron-recurring.mjs
 *
 * Required env vars:
 *   POCKETBASE_URL            — PocketBase instance URL
 *   POCKETBASE_ADMIN_EMAIL    — Superuser email
 *   POCKETBASE_ADMIN_PASSWORD — Superuser password
 *
 * Optional env vars:
 *   POCKETBASE_TIMEOUT_MS     — Request timeout in ms (default: 30000)
 *   POCKETBASE_RETRIES        — Retry attempts per operation (default: 5)
 */

import PocketBase from "pocketbase";

const PB_URL = process.env.POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const TIMEOUT_MS = parseInt(process.env.POCKETBASE_TIMEOUT_MS || "30000", 10);
const RETRIES = parseInt(process.env.POCKETBASE_RETRIES || "5", 10);

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing env vars. Required: POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD"
  );
  process.exit(1);
}

// Strip any embedded credentials and trailing slashes for safe logging.
function formatUrlForLogs(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return url;
  }
}

// Wrap global fetch with a hard timeout so PocketBase SDK requests can't hang forever.
const originalFetch = globalThis.fetch;
globalThis.fetch = async function fetchWithTimeout(input, init = {}) {
  // Respect an existing signal if the caller already supplied one.
  if (init.signal) {
    return originalFetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await originalFetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(err) {
  if (!err) return false;
  if (err.status === 0) return true;
  if (err.originalError?.code === "ETIMEDOUT") return true;
  if (err.originalError?.code === "ECONNREFUSED") return true;
  if (err.originalError?.code === "ENOTFOUND") return true;
  const msg = String(err.message || err);
  return /fetch failed|timeout|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|abort/i.test(msg);
}

// Retry helper with exponential backoff + jitter for transient network failures.
async function withRetry(fn, label = "operation") {
  let lastErr;
  for (let i = 0; i < RETRIES; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || i === RETRIES - 1) throw err;
      const baseDelay = Math.min(1000 * 2 ** i, 30000);
      const jitter = Math.floor(Math.random() * 1000);
      const wait = baseDelay + jitter;
      console.warn(
        `  ⚠️ ${label} failed (attempt ${i + 1}/${RETRIES}): ${
          err.message || err
        }. Retrying in ${wait}ms…`
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

// Hit the unauthenticated /api/health endpoint before burning auth attempts.
async function checkPocketBaseHealth() {
  const healthUrl = `${PB_URL.replace(/\/+$/, "")}/api/health`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTitlePrefix(period, now) {
  const day = now.getDate();
  const month = MONTHS_SHORT[now.getMonth()];
  const year = now.getFullYear();
  const yearShort = String(year).slice(2);

  if (period === "monthly") {
    // [Apr'26]
    return `[${month}'${yearShort}]`;
  }
  // weekly or daily: [16-Apr-2026]
  return `[${String(day).padStart(2, "0")}-${month}-${year}]`;
}

function todayDateString(now) {
  return now.toISOString().slice(0, 10); // "2026-04-16"
}

async function main() {
  console.log(`[cron] PocketBase endpoint: ${formatUrlForLogs(PB_URL)}`);
  console.log(`[cron] Timeout: ${TIMEOUT_MS}ms, Retries: ${RETRIES}`);

  // Verify connectivity before attempting authentication.
  const healthy = await withRetry(async () => {
    const ok = await checkPocketBaseHealth();
    if (!ok) throw new Error("PocketBase health check returned non-OK response");
    return ok;
  }, "PocketBase health check");

  if (healthy) {
    console.log("[cron] PocketBase health check passed");
  }

  // Authenticate as admin (with retries for transient network errors).
  await withRetry(
    () =>
      pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD),
    "PocketBase admin auth"
  );
  console.log("[cron] Authenticated as admin");

  const now = new Date();
  const todayStr = todayDateString(now);
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const dayOfMonth = now.getDate(); // 1-31

  // Fetch all active, non-deleted recurring jobs (with retries).
  const jobs = await withRetry(
    () =>
      pb.collection("recurring_jobs").getFullList({
        filter: `is_active = true && is_deleted = false`,
      }),
    "Fetch recurring jobs"
  );

  console.log(`[${todayStr}] Found ${jobs.length} active recurring job(s)`);

  let executed = 0;

  for (const job of jobs) {
    // Skip if already executed today.
    const lastExec = job.last_executed_at ? job.last_executed_at.slice(0, 10) : "";
    if (lastExec === todayStr) {
      continue;
    }

    // Check if today matches the schedule.
    let shouldExecute = false;
    const days = job.days; // array or null

    if (job.period === "daily") {
      shouldExecute = true;
    } else if (job.period === "weekly") {
      shouldExecute = Array.isArray(days) && days.includes(dayOfWeek);
    } else if (job.period === "monthly") {
      shouldExecute = Array.isArray(days) && days.includes(dayOfMonth);
    }

    if (!shouldExecute) continue;

    try {
      // Fetch the template task (with retries).
      const template = await withRetry(
        () => pb.collection("tasks").getOne(job.template_task_id),
        `Fetch template for job ${job.id}`
      );

      if (template.is_deleted) {
        console.log(`  Skipping job ${job.id}: template task ${job.template_task_id} is deleted`);
        continue;
      }

      // Generate prefixed title.
      const prefix = formatTitlePrefix(job.period, now);
      const newTitle = `${prefix} - ${template.title}`;

      // Count existing tasks in backlog for sort_order (with retries).
      const backlogList = await withRetry(
        () =>
          pb.collection("tasks").getList(1, 1, {
            filter: `owner = "${job.owner}" && space = "${template.space}" && status = "backlog" && is_deleted = false`,
            sort: "-sort_order",
          }),
        `Fetch backlog for job ${job.id}`
      );
      const nextSortOrder = backlogList.totalItems > 0
        ? (backlogList.items[0]?.sort_order ?? 0) + 1
        : 1;

      // Create the new task (with retries).
      await withRetry(
        () =>
          pb.collection("tasks").create({
            title: newTitle,
            description: template.description || "",
            status: "backlog",
            tags: template.tags || [],
            space: template.space,
            sort_order: nextSortOrder,
            owner: job.owner,
            recurring_job_id: job.id,
            is_deleted: false,
          }),
        `Create task for job ${job.id}`
      );

      // Update the job's last_executed_at (with retries).
      await withRetry(
        () =>
          pb.collection("recurring_jobs").update(job.id, {
            last_executed_at: todayStr,
          }),
        `Update job ${job.id}`
      );

      executed++;
      console.log(`  ✅ Created task: "${newTitle}" (job ${job.id})`);
    } catch (err) {
      console.error(`  ❌ Failed for job ${job.id}:`, err.message || err);
    }
  }

  console.log(`[${todayStr}] Done. Executed ${executed}/${jobs.length} job(s).`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
