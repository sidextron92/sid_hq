// PocketBase cron hook that creates recurring tasks daily at 06:00 UTC.
// Place this file in the PocketBase `pb_hooks/` directory and restart PocketBase.
// It runs entirely inside the PocketBase process, so it doesn't depend on
// external schedulers or network reachability.

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

// Daily at 06:00 UTC. Adjust the expression if your server uses a different timezone.
cronAdd("recurring-tasks", "0 6 * * *", () => {
  const now = new Date();
  const todayStr = todayDateString(now);
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const dayOfMonth = now.getDate(); // 1-31

  const jobs = $app.findRecordsByFilter(
    "recurring_jobs",
    "is_active = true && is_deleted = false",
    "-created",
    0,
    0
  );

  console.log(`[${todayStr}] Found ${jobs.length} active recurring job(s)`);

  let executed = 0;

  for (const job of jobs) {
    // Skip if already executed today.
    const lastExec = (job.getString("last_executed_at") || "").slice(0, 10);
    if (lastExec === todayStr) {
      continue;
    }

    // Check if today matches the schedule.
    let shouldExecute = false;
    const period = job.getString("period");
    const days = job.get("days");

    if (period === "daily") {
      shouldExecute = true;
    } else if (period === "weekly") {
      shouldExecute = Array.isArray(days) && days.includes(dayOfWeek);
    } else if (period === "monthly") {
      shouldExecute = Array.isArray(days) && days.includes(dayOfMonth);
    }

    if (!shouldExecute) continue;

    try {
      const template = $app.findRecordById("tasks", job.getString("template_task_id"));

      if (template.getBool("is_deleted")) {
        console.log(`  Skipping job ${job.id}: template task ${template.id} is deleted`);
        continue;
      }

      // Generate prefixed title.
      const prefix = formatTitlePrefix(period, now);
      const newTitle = `${prefix} - ${template.getString("title")}`;

      // Count existing backlog tasks to determine the next sort_order.
      const backlog = $app.findRecordsByFilter(
        "tasks",
        `owner = "${job.getString("owner")}" && space = "${template.getString("space")}" && status = "backlog" && is_deleted = false`,
        "-sort_order",
        1,
        0
      );
      const nextSortOrder = backlog.length > 0
        ? (backlog[0].getInt("sort_order") || 0) + 1
        : 1;

      // Create the new task.
      const tasksCollection = $app.findCollectionByName("tasks");
      const newTask = new Record(tasksCollection, {
        title: newTitle,
        description: template.getString("description") || "",
        status: "backlog",
        tags: template.get("tags") || [],
        space: template.getString("space"),
        sort_order: nextSortOrder,
        owner: job.getString("owner"),
        recurring_job_id: job.id,
        is_deleted: false,
      });
      $app.save(newTask);

      // Update the job's last_executed_at.
      job.set("last_executed_at", todayStr);
      $app.save(job);

      executed++;
      console.log(`  ✅ Created task: "${newTitle}" (job ${job.id})`);
    } catch (err) {
      console.error(`  ❌ Failed for job ${job.id}:`, err);
    }
  }

  console.log(`[${todayStr}] Done. Executed ${executed}/${jobs.length} job(s).`);
});
