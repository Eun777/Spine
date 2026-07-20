import { requireUuid, supabaseEqFilter } from "./security";
import { getSupabaseConfig } from "./supabase-server";

const WINDOW_LIMITS = [
  { windowMs: 10 * 60 * 1000, max: Number(process.env.AI_SCAN_LIMIT_PER_10_MINUTES || 3), label: "10 minutes" },
  { windowMs: 24 * 60 * 60 * 1000, max: Number(process.env.AI_SCAN_LIMIT_PER_DAY || 20), label: "24 hours" },
] as const;

type UsageEvent = {
  userId: string;
  endpoint: "recognize-books";
};

type InMemoryEvent = UsageEvent & {
  createdAt: number;
};

const memoryEvents: InMemoryEvent[] = [];

export class AiRateLimiter {
  async assertAllowed(event: UsageEvent) {
    const userId = requireUuid(event.userId, "user id");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { url } = getSupabaseConfig();

    if (url && serviceKey) return this.assertAllowedWithSupabase(url, serviceKey, { ...event, userId });
    return this.assertAllowedInMemory({ ...event, userId });
  }

  private async assertAllowedWithSupabase(url: string, serviceKey: string, event: UsageEvent) {
    for (const limit of WINDOW_LIMITS) {
      const since = new Date(Date.now() - limit.windowMs).toISOString();
      const response = await fetch(
        `${url}/rest/v1/ai_usage_events?select=id&user_id=${supabaseEqFilter(event.userId)}&endpoint=${supabaseEqFilter(event.endpoint)}&created_at=gte.${encodeURIComponent(since)}`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: "count=exact",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) throw new Error("Could not evaluate AI usage limit");
      const count = Number(response.headers.get("content-range")?.split("/")?.[1] || 0);
      if (count >= limit.max) throw new AiRateLimitError(`AI scan limit reached. Try again after ${limit.label}.`);
    }

    await this.recordSupabaseEvent(url, serviceKey, event);
  }

  private async recordSupabaseEvent(url: string, serviceKey: string, event: UsageEvent) {
    const response = await fetch(`${url}/rest/v1/ai_usage_events`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: event.userId,
        endpoint: event.endpoint,
      }),
    });

    if (!response.ok) throw new Error("Could not record AI usage event");
  }

  private assertAllowedInMemory(event: UsageEvent) {
    const now = Date.now();
    for (const limit of WINDOW_LIMITS) {
      const cutoff = now - limit.windowMs;
      const count = memoryEvents.filter((saved) =>
        saved.userId === event.userId &&
        saved.endpoint === event.endpoint &&
        saved.createdAt >= cutoff
      ).length;

      if (count >= limit.max) throw new AiRateLimitError(`AI scan limit reached. Try again after ${limit.label}.`);
    }

    memoryEvents.push({ ...event, createdAt: now });
    const oldestWindow = Math.max(...WINDOW_LIMITS.map((limit) => limit.windowMs));
    while (memoryEvents[0] && memoryEvents[0].createdAt < now - oldestWindow) memoryEvents.shift();
  }
}

export class AiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRateLimitError";
  }
}

export const aiRateLimiter = new AiRateLimiter();
