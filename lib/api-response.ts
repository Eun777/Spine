import { NextResponse } from "next/server";

export type ApiErrorOptions = {
  status?: number;
  cause?: unknown;
};

export function apiError(message: string, options: ApiErrorOptions = {}) {
  if (options.cause) {
    console.error(message, options.cause);
  }

  return NextResponse.json({ error: message }, { status: options.status || 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function readSupabaseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return {
    message: typeof body.message === "string" ? body.message : fallback,
    status: response.status,
    code: body.code,
  };
}
