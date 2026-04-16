#!/usr/bin/env node

/**
 * Cron job for recurring tasks.
 * Run daily at 6 AM: 0 6 * * * node /path/to/scripts/cron-recurring.mjs
 *
 * Required env vars:
 *   POCKETBASE_URL          — PocketBase instance URL
 *   POCKETBASE_ADMIN_EMAIL  — Superuser email
 *   POCKETBASE_ADMIN_PASSWORD — Superuser password
 */

import PocketBase from "pocketbase";

const PB_URL = process.env.POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!PB_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Missing env vars. Required: POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD"
  );
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

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
  // Authenticate as admin
  await pb.collection("_superusers").authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

  const now = new Date();
  const todayStr = todayDateString(now);
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const dayOfMonth = now.getDate(); // 1-31

  // Fetch all active, non-deleted recurring jobs
  const jobs = await pb.collection("recurring_jobs").getFullList({
    filter: `is_active = true && is_deleted = false`,
  });

  console.log(`[${todayStr}] Found ${jobs.length} active recurring job(s)`);

  let executed = 0;

  for (const job of jobs) {
    // Skip if already executed today
    const lastExec = job.last_executed_at ? job.last_executed_at.slice(0, 10) : "";
    if (lastExec === todayStr) {
      continue;
    }

    // Check if today matches the schedule
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
      // Fetch the template task
      const template = await pb.collection("tasks").getOne(job.template_task_id);

      if (template.is_deleted) {
        console.log(`  Skipping job ${job.id}: template task ${job.template_task_id} is deleted`);
        continue;
      }

      // Generate prefixed title
      const prefix = formatTitlePrefix(job.period, now);
      const newTitle = `${prefix} - ${template.title}`;

      // Count existing tasks in backlog for sort_order
      const backlogList = await pb.collection("tasks").getList(1, 1, {
        filter: `owner = "${job.owner}" && space = "${template.space}" && status = "backlog" && is_deleted = false`,
        sort: "-sort_order",
      });
      const nextSortOrder = backlogList.totalItems > 0
        ? (backlogList.items[0]?.sort_order ?? 0) + 1
        : 1;

      // Create the new task
      await pb.collection("tasks").create({
        title: newTitle,
        description: template.description || "",
        status: "backlog",
        tags: template.tags || [],
        space: template.space,
        sort_order: nextSortOrder,
        owner: job.owner,
        recurring_job_id: job.id,
        is_deleted: false,
      });

      // Update the job's last_executed_at
      await pb.collection("recurring_jobs").update(job.id, {
        last_executed_at: todayStr,
      });

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
