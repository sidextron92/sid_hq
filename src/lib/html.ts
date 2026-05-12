export function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  // SSR fallback
  return html.replace(/<[^>]*>/g, "");
}

/** Lightweight, DOM-free HTML strip for performance-critical paths (e.g. search filters). */
export function fastStripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}
