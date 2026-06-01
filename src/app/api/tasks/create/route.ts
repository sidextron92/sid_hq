import { NextRequest, NextResponse } from "next/server";

const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const TASK_API_KEY = process.env.TASK_API_KEY;
const OWNER_ID = "gcyr41ajgbvsf2p";

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

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== TASK_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, space, tags = [] } = body;

    // Validation
    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!space || typeof space !== "string") {
      return NextResponse.json({ error: "Space is required" }, { status: 400 });
    }

    const token = await getAdminToken();

    // Create task
    const taskPayload = {
      title: title.trim(),
      description: "",
      status: "backlog",
      tags: Array.isArray(tags) ? tags : [],
      space,
      sort_order: 0,
      is_deleted: false,
      owner: OWNER_ID,
    };

    const resp = await fetch(`${PB_URL}/api/collections/tasks/records`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(taskPayload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create task: ${resp.status}`);
    }

    const record = await resp.json();

    return NextResponse.json({
      success: true,
      task: {
        id: record.id,
        title: record.title,
        space: record.space,
        status: record.status,
        tags: record.tags || [],
      },
    });
  } catch (error) {
    console.error("[tasks/create] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
