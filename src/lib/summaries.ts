export type SummaryChannel = "slack" | "email" | "whatsapp";

export type SummaryDate = {
  date: string;
  channels: SummaryChannel[];
};

export const SUMMARY_CHANNELS: SummaryChannel[] = ["slack", "email", "whatsapp"];

export const SUMMARY_CHANNEL_FOLDER: Record<SummaryChannel, string> = {
  slack: "Slack",
  email: "Email",
  whatsapp: "WhatsApp",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isSummaryChannel(value: string): value is SummaryChannel {
  return SUMMARY_CHANNELS.includes(value as SummaryChannel);
}

export function isSummaryDate(value: string) {
  return DATE_RE.test(value);
}

export function getSummariesBaseUrl() {
  return process.env.SUMMARIES_BASE_URL?.replace(/\/+$/, "") || "";
}

export function getReportsRoot() {
  return process.env.SUMMARIES_REPORTS_ROOT || "Daily Reports";
}

export function getSummaryAuthHeaders(): HeadersInit {
  const token = process.env.SUMMARIES_API_KEY;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function buildRemoteSummaryUrl(date: string, channel: SummaryChannel) {
  const explicit = process.env.SUMMARIES_SUMMARY_URL;
  if (explicit) {
    return explicit
      .replace(/\{date\}/g, encodeURIComponent(date))
      .replace(/\{channel\}/g, encodeURIComponent(channel));
  }

  const baseUrl = getSummariesBaseUrl();
  if (process.env.SUMMARIES_USE_FILE_PATHS !== "true") {
    return `${baseUrl}/api/summary/${encodeURIComponent(date)}/${encodeURIComponent(channel)}`;
  }

  const path = [getReportsRoot(), date, SUMMARY_CHANNEL_FOLDER[channel], "summary.html"]
    .map(encodeURIComponent)
    .join("/");
  return `${baseUrl}/${path}`;
}

export function buildRemoteIndexUrl() {
  const explicit = process.env.SUMMARIES_INDEX_URL;
  if (explicit) return explicit;

  const baseUrl = getSummariesBaseUrl();
  if (process.env.SUMMARIES_USE_FILE_PATHS !== "true") {
    return `${baseUrl}/api/dates`;
  }

  const path = [getReportsRoot(), "index.json"].map(encodeURIComponent).join("/");
  return `${baseUrl}/${path}`;
}

export function normalizeSummaryDates(input: unknown): SummaryDate[] {
  const rawDates = Array.isArray(input)
    ? input
    : input && typeof input === "object" && "dates" in input && Array.isArray(input.dates)
      ? input.dates
      : [];

  return rawDates
    .map((item): SummaryDate | null => {
      if (typeof item === "string") {
        return isSummaryDate(item) ? { date: item, channels: [...SUMMARY_CHANNELS] } : null;
      }

      if (!item || typeof item !== "object" || !("date" in item) || typeof item.date !== "string") {
        return null;
      }

      const itemChannels: unknown[] = "channels" in item && Array.isArray(item.channels)
        ? item.channels
        : [...SUMMARY_CHANNELS];
      const channels = itemChannels.filter(
        (channel): channel is SummaryChannel => typeof channel === "string" && isSummaryChannel(channel)
      );

      return isSummaryDate(item.date) ? { date: item.date, channels } : null;
    })
    .filter((item): item is SummaryDate => Boolean(item))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[\da-fA-F]+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function repairReportMessageText(html: string) {
  const msgStartRe = /<div\s+class=("|')msg\1\s*>/gi;
  let result = "";
  let cursor = 0;
  let match = msgStartRe.exec(html);

  while (match) {
    const blockStart = match.index;
    const nextMatch = msgStartRe.exec(html);
    const blockEnd = nextMatch?.index ?? html.length;

    result += html.slice(cursor, blockStart);
    result += normalizeReportMessageBlock(html.slice(blockStart, blockEnd));

    cursor = blockEnd;
    match = nextMatch;
  }

  result += html.slice(cursor);
  return result;
}

function stripTrailingDivClosures(value: string) {
  let next = value;
  for (let i = 0; i < 3; i += 1) {
    next = next.replace(/\s*<\/div>\s*$/i, "");
  }
  return next;
}

function normalizeReportMessageBlock(block: string) {
  const time = block.match(/<div\s+class=("|')time\1\s*>([\s\S]*?)<\/div>/i)?.[2] ?? "";
  const badge = block.match(/<span\s+class=("|')badge\s+(ch|dm)\1\s*>([\s\S]*?)<\/span>/i);
  const author = block.match(/<span\s+class=("|')author\1\s*>([\s\S]*?)<\/span>/i)?.[2] ?? "";
  const textOpen = block.match(/<div\s+class=("|')text\1\s*>/i);

  if (!textOpen || textOpen.index === undefined) return block;

  const contentStart = textOpen.index + textOpen[0].length;
  const text = stripTrailingDivClosures(block.slice(contentStart));
  const badgeType = badge?.[2] === "dm" ? "dm" : "ch";
  const badgeText = badge?.[3] ?? "";

  return `
  <div class="msg">
    <div class="time">${escapeHtmlText(time)}</div>
    <div class="body">
      <span class="badge ${badgeType}">${escapeHtmlText(badgeText)}</span><span class="author">${escapeHtmlText(author)}</span>
      <div class="text">${escapeHtmlText(text)}</div>
    </div>
  </div>`;
}

export function sanitizeSummaryHtml(html: string) {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = repairReportMessageText(bodyMatch ? bodyMatch[1] : html);

  return bodyHtml
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?html\b[^>]*>/gi, "")
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<(iframe|object|embed|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "");
}
