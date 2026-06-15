console.log("RECURRING CRON REGISTERED");
cronAdd("recurring-tasks", "0 7 * * *", function() {
  var MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  function padStart(str, targetLength, padString) {
    str = String(str);
    padString = padString || " ";
    if (str.length >= targetLength) return str;
    var padding = "";
    while (padding.length < targetLength - str.length) padding += padString;
    return padding.slice(0, targetLength - str.length) + str;
  }

  function formatTitlePrefix(period, now) {
    var day = now.getDate();
    var month = MONTHS_SHORT[now.getMonth()];
    var year = now.getFullYear();
    var yearShort = String(year).slice(2);
    if (period === "monthly") return "[" + month + "'" + yearShort + "]";
    return "[" + padStart(day, 2, "0") + "-" + month + "-" + year + "]";
  }

  function todayDateString(now) {
    return now.toISOString().slice(0, 10);
  }

  var now;
  var todayStr;
  var dayOfWeek;
  var dayOfMonth;
  try {
    now = new Date();
    todayStr = todayDateString(now);
    dayOfWeek = now.getDay();
    dayOfMonth = now.getDate();
  } catch (err) {
    console.error("[recurring-tasks] DATE SETUP FAILED:", err);
    return;
  }

  console.log("[" + todayStr + "] START cron");

  var jobs = [];
  try {
    jobs = $app.findRecordsByFilter(
      "recurring_jobs",
      "is_active = true && is_deleted = false",
      "-created",
      0,
      0
    );
    console.log("[" + todayStr + "] FOUND " + jobs.length + " jobs");
  } catch (err) {
    console.error("[" + todayStr + "] ERROR fetching jobs:", err);
    return;
  }

  var executed = 0;
  for (var i = 0; i < jobs.length; i++) {
    var job = jobs[i];
    var lastExec = (job.getString("last_executed_at") || "").slice(0, 10);
    if (lastExec === todayStr) continue;

    var shouldExecute = false;
    var period = job.getString("period");
    var days = job.get("days");
    if (period === "daily") shouldExecute = true;
    else if (period === "weekly") shouldExecute = Array.isArray(days) && days.indexOf(dayOfWeek) !== -1;
    else if (period === "monthly") shouldExecute = Array.isArray(days) && days.indexOf(dayOfMonth) !== -1;
    if (!shouldExecute) continue;

    try {
      var template = $app.findRecordById("tasks", job.getString("template_task_id"));
      if (template.getBool("is_deleted")) continue;

      var prefix = formatTitlePrefix(period, now);
      var newTitle = prefix + " - " + template.getString("title");

      var backlog = $app.findRecordsByFilter(
        "tasks",
        'owner = "' + job.getString("owner") + '" && space = "' + template.getString("space") + '" && status = "backlog" && is_deleted = false',
        "-sort_order",
        1,
        0
      );
      var nextSortOrder = backlog.length > 0 ? (backlog[0].getInt("sort_order") || 0) + 1 : 1;

      var tasksCollection = $app.findCollectionByName("tasks");
      var newTask = new Record(tasksCollection, {
        title: newTitle,
        description: template.getString("description") || "",
        status: "backlog",
        tags: template.get("tags") || [],
        space: template.getString("space"),
        sort_order: nextSortOrder,
        owner: job.getString("owner"),
        recurring_job_id: job.id,
        is_deleted: false
      });
      $app.save(newTask);

      job.set("last_executed_at", todayStr);
      $app.save(job);

      executed++;
      console.log("  Created task: " + newTitle);
    } catch (err) {
      console.error("  Failed job " + job.id + ":", err);
    }
  }

  console.log("[" + todayStr + "] DONE executed=" + executed);
});
