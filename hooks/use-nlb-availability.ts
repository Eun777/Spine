"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cleanBookKey } from "@/lib/book-utils";
import type { NlbAvailabilityResult } from "@/lib/nlb-catalogue";
import type { Book } from "@/lib/types";

const CACHE_KEY = "spine-nlb-availability-v1";
const LAST_MANUAL_REFRESH_KEY = "spine-nlb-availability-manual-refresh-at";
const AUTO_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MANUAL_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const REFRESH_QUEUE_DELAY_MS = 30 * 1000;

export type CachedNlbAvailability = NlbAvailabilityResult & {
  cacheKey: string;
  error?: string;
};

type AvailabilityCacheRecord = Record<string, CachedNlbAvailability>;

export class NlbAvailabilityCache {
  read(): AvailabilityCacheRecord {
    if (typeof window === "undefined") return {};
    try {
      const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  write(cache: AvailabilityCacheRecord) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  get(book: Book) {
    return this.read()[availabilityKeyForBook(book)];
  }

  merge(book: Book, availability: NlbAvailabilityResult) {
    const cache = this.read();
    const cacheKey = availabilityKeyForBook(book);
    cache[cacheKey] = { ...availability, cacheKey };
    this.write(cache);
    return cache;
  }

  isStale(entry?: CachedNlbAvailability) {
    if (!entry?.checkedAt) return true;
    return Date.now() - new Date(entry.checkedAt).getTime() >= AUTO_REFRESH_INTERVAL_MS;
  }

  readLastManualRefreshAt() {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(LAST_MANUAL_REFRESH_KEY) || 0);
  }

  markManualRefresh() {
    const now = Date.now();
    if (typeof window !== "undefined") localStorage.setItem(LAST_MANUAL_REFRESH_KEY, String(now));
    return now;
  }
}

export function useNlbAvailability(books: Book[], showToast: (message: string, duration?: number) => void) {
  const cacheStore = useMemo(() => new NlbAvailabilityCache(), []);
  const [availabilityByKey, setAvailabilityByKey] = useState<AvailabilityCacheRecord>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const activeQueueId = useRef(0);

  useEffect(() => {
    setAvailabilityByKey(cacheStore.read());
    setLastManualRefreshAt(cacheStore.readLastManualRefreshAt());
  }, [cacheStore]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchAvailability = useCallback(async (book: Book, force = false) => {
    const cacheKey = availabilityKeyForBook(book);
    const cached = cacheStore.get(book);
    if (!force && !cacheStore.isStale(cached)) return cached;

    setLoadingKeys((current) => new Set(current).add(cacheKey));
    try {
      const params = new URLSearchParams();
      if (book.isbn) params.set("isbn", book.isbn);
      params.set("title", book.title);
      params.set("author", book.author || "");

      const response = await fetch(`/api/nlb/availability?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not check NLB availability");

      const updatedCache = cacheStore.merge(book, data);
      setAvailabilityByKey(updatedCache);
      return updatedCache[cacheKey];
    } catch (error) {
      const fallback = unavailableResultForBook(book, error);
      const updatedCache = cacheStore.merge(book, fallback);
      setAvailabilityByKey(updatedCache);
      throw error;
    } finally {
      setLoadingKeys((current) => {
        const next = new Set(current);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [cacheStore]);

  const runAvailabilityQueue = useCallback(async (queue: Book[], force = false) => {
    const queueId = ++activeQueueId.current;
    let processed = 0;
    let failures = 0;

    for (let index = 0; index < queue.length; index++) {
      if (queueId !== activeQueueId.current) break;

      try {
        await fetchAvailability(queue[index], force);
      } catch {
        failures += 1;
      } finally {
        processed += 1;
      }

      if (index < queue.length - 1 && queueId === activeQueueId.current) {
        await delay(REFRESH_QUEUE_DELAY_MS);
      }
    }

    return { processed, failures, cancelled: queueId !== activeQueueId.current };
  }, [fetchAvailability]);

  useEffect(() => {
    if (!books.length) return;

    const candidates = prioritizeAvailabilityQueue(
      books.filter((book) => cacheStore.isStale(cacheStore.get(book))),
      cacheStore.read()
    );
    if (!candidates.length) return;

    runAvailabilityQueue(candidates).then((result) => {
      if (!result.cancelled && result.processed > 0 && result.failures === result.processed) {
        showToast("Could not refresh NLB availability", 2600);
      }
    });

    return () => {
      activeQueueId.current += 1;
    };
  }, [books, cacheStore, now, runAvailabilityQueue, showToast]);

  const nextManualRefreshAt = lastManualRefreshAt + MANUAL_REFRESH_INTERVAL_MS;
  const canManualRefresh = now >= nextManualRefreshAt;

  async function refreshAllAvailability() {
    if (!books.length) return;
    if (!canManualRefresh) {
      showToast(`You can refresh NLB availability again in ${minutesUntil(nextManualRefreshAt)} min`, 2600);
      return;
    }

    setLastManualRefreshAt(cacheStore.markManualRefresh());
    const queue = prioritizeAvailabilityQueue(books, cacheStore.read());
    showToast(`Refreshing ${queue.length} NLB ${queue.length === 1 ? "record" : "records"} in order`, 2600);
    const result = await runAvailabilityQueue(queue, true);
    if (result.cancelled) return;

    if (result.failures === result.processed) {
      showToast("Could not refresh NLB availability", 2600);
    } else if (result.failures > 0) {
      showToast("Some NLB availability checks failed", 2600);
    } else {
      showToast("NLB availability refreshed", 2200);
    }
  }

  return {
    availabilityByBookId: Object.fromEntries(
      books.map((book) => [book.id, availabilityByKey[availabilityKeyForBook(book)]])
    ) as Record<string, CachedNlbAvailability | undefined>,
    loadingBookIds: new Set(books.filter((book) => loadingKeys.has(availabilityKeyForBook(book))).map((book) => book.id)),
    refreshAllAvailability,
    canManualRefresh,
    nextManualRefreshAt,
  };
}

export function availabilityKeyForBook(book: Pick<Book, "isbn" | "title" | "author">) {
  if (book.isbn) return `isbn:${cleanBookKey(book.isbn)}`;
  return `title-author:${cleanBookKey(book.title)}:${cleanBookKey(book.author)}`;
}

function minutesUntil(timestamp: number) {
  return Math.max(1, Math.ceil((timestamp - Date.now()) / 60000));
}

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function prioritizeAvailabilityQueue(books: Book[], cache: AvailabilityCacheRecord) {
  const confirmedOrNew: Book[] = [];
  const previouslyUnmatched: Book[] = [];

  for (const book of books) {
    const cached = cache[availabilityKeyForBook(book)];
    if (cached?.matched === false) previouslyUnmatched.push(book);
    else confirmedOrNew.push(book);
  }

  return [...confirmedOrNew, ...previouslyUnmatched];
}

function unavailableResultForBook(book: Book, error: unknown): NlbAvailabilityResult & { error: string } {
  return {
    matched: false,
    source: book.isbn ? "isbn" : "title_author",
    checkedAt: new Date().toISOString(),
    totalItems: 0,
    availableItems: 0,
    items: [],
    error: error instanceof Error ? error.message : "Could not check NLB availability",
  };
}
