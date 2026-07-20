import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { NlbCatalogueClient, NlbCatalogueError, normalizeIsbn } from "@/lib/nlb-catalogue";
import { getAuthenticatedUser } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await getAuthenticatedUser()) return apiError("Authentication required", { status: 401 });

  const apiKey = process.env.NLB_API_KEY;
  if (!apiKey) return apiError("NLB availability is not configured yet. Add NLB_API_KEY to .env.local.", { status: 503 });
  const appCode = process.env.NLB_APP_CODE || process.env.NLB_APP_ID || process.env.NLB_API_ID;
  if (!appCode) return apiError("NLB availability is not configured yet. Add NLB_APP_CODE to .env.local.", { status: 503 });

  const params = new URL(request.url).searchParams;
  const isbn = normalizeIsbn(params.get("isbn"));
  const title = params.get("title")?.trim().slice(0, 200) || "";
  const author = params.get("author")?.trim().slice(0, 200) || "";

  if (!isbn && !title) return apiError("Provide an ISBN or title to check NLB availability.", { status: 400 });

  try {
    const client = new NlbCatalogueClient(apiKey, appCode, process.env.NLB_CATALOGUE_BASE_URL);
    const availability = await client.getAvailability({ isbn, title, author });
    return NextResponse.json(availability);
  } catch (error) {
    if (error instanceof NlbCatalogueError) {
      const status = error.status === 429 ? 429 : 502;
      return apiError(error.message, { status, cause: { provider: "nlb", status: error.status } });
    }

    return apiError("Could not check NLB availability right now.", { status: 502, cause: error });
  }
}
