import { NextRequest, NextResponse } from "next/server";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const TASK_API_KEY = process.env.TASK_API_KEY;
const OWNER_ID = "gcyr41ajgbvsf2p";

interface PBRecord {
  id: string;
  name: string;
  color?: string;
  is_default?: boolean;
  space?: string;
}

async function getAdminToken(): Promise<string> {
  const resp = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!resp.ok) {
    throw new Error(`PocketBase auth failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.token as string;
}

export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== TASK_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getAdminToken();
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch spaces
    const spacesResp = await fetch(
      `${PB_URL}/api/collections/spaces/records?filter=${encodeURIComponent(`owner = "${OWNER_ID}"`)}&sort=-is_default,name`,
      { headers }
    );
    if (!spacesResp.ok) throw new Error("Failed to fetch spaces");
    const spacesData = await spacesResp.json();
    const spaces: PBRecord[] = spacesData.items || [];

    // Fetch tags
    const tagsResp = await fetch(
      `${PB_URL}/api/collections/tags/records?filter=${encodeURIComponent(`owner = "${OWNER_ID}"`)}&sort=name`,
      { headers }
    );
    if (!tagsResp.ok) throw new Error("Failed to fetch tags");
    const tagsData = await tagsResp.json();
    const tags: PBRecord[] = tagsData.items || [];

    // Build tagsBySpace
    const tagsBySpace: Record<string, { id: string; name: string }[]> = {};
    for (const space of spaces) {
      tagsBySpace[space.id] = [];
    }
    for (const tag of tags) {
      if (tag.space && tagsBySpace[tag.space]) {
        tagsBySpace[tag.space].push({ id: tag.id, name: tag.name });
      }
    }

    return NextResponse.json({
      spaces: spaces.map((s) => ({ id: s.id, name: s.name })),
      tagsBySpace,
    });
  } catch (error) {
    console.error("[tasks/meta] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
