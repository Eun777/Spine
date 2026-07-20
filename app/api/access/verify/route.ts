import { NextResponse } from "next/server";
import { apiError, readJson } from "@/lib/api-response";
import { codeMatches, grantAiAccess } from "@/lib/ai-access";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export async function POST(request: Request) {
  if (!await getAuthenticatedUser()) return apiError("Authentication required", { status: 401 });

  const body = await readJson(request);
  const code = body && typeof body === "object" ? String((body as { code?: unknown }).code || "") : "";
  if (!codeMatches(code)) return apiError("That access code is not valid", { status: 403 });

  grantAiAccess();
  return NextResponse.json({ unlocked: true });
}
