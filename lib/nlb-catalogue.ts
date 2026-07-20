import { cleanBookKey } from "./book-utils";

const DEFAULT_BASE_URL = "https://openweb.nlb.gov.sg/api/v2/Catalogue";
const ISBN_PATTERN = /^(?:\d{9}[\dXx]|97[89]\d{10})$/;
const AVAILABLE_TRANSACTION_CODES = new Set(["S"]);
const AVAILABLE_STATUS_NAMES = new Set(["available", "on shelf", "not on loan"]);

export type NlbAvailabilityItem = {
  itemId: string | null;
  branchCode: string | null;
  branchName: string;
  statusCode: string | null;
  statusName: string;
  transactionStatusCode: string | null;
  transactionStatusName: string | null;
  callNumber: string | null;
  isAvailable: boolean;
};

export type NlbAvailabilityResult = {
  matched: boolean;
  source: "isbn" | "title_author";
  checkedAt: string;
  matchedTitle?: {
    brn: number | null;
    title: string | null;
    author: string | null;
    isbns: string[];
  };
  totalItems: number;
  availableItems: number;
  items: NlbAvailabilityItem[];
};

type NlbTitle = {
  brn?: number;
  title?: string;
  author?: string;
  isbns?: string[];
};

type NlbAvailabilityApiItem = {
  itemId?: string;
  callNumber?: string;
  formattedCallNumber?: string;
  location?: { code?: string; name?: string };
  status?: { code?: string | null; name?: string };
  transactionStatus?: { code?: string | null; name?: string | null };
};

export class NlbCatalogueClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly appCode: string;

  constructor(apiKey: string, appCode: string, baseUrl = DEFAULT_BASE_URL) {
    if (!apiKey) throw new Error("NLB API key is required");
    if (!appCode) throw new Error("NLB app code is required");
    this.apiKey = apiKey;
    this.appCode = appCode;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getAvailability(input: { isbn?: string; title?: string; author?: string }): Promise<NlbAvailabilityResult> {
    const isbn = normalizeIsbn(input.isbn);
    if (isbn) {
      return this.getAvailabilityByIdentifier({ ISBN: isbn }, "isbn");
    }

    const title = input.title?.trim();
    if (!title) throw new Error("Provide an ISBN or title to check availability");

    const matchedTitle = await this.findBestTitleMatch(title, input.author?.trim() || "");
    if (!matchedTitle?.brn) {
      return emptyAvailability("title_author");
    }

    return this.getAvailabilityByIdentifier({ BRN: String(matchedTitle.brn) }, "title_author", matchedTitle);
  }

  private async findBestTitleMatch(title: string, author: string) {
    const params = new URLSearchParams({ Title: title.slice(0, 200), Limit: "5" });
    if (author) params.set("Author", author.slice(0, 200));

    const data = await this.request<{ titles?: NlbTitle[] }>("/GetTitles", params).catch((error) => {
      if (error instanceof NlbCatalogueError && error.status === 404) return { titles: [] };
      throw error;
    });
    const titles = Array.isArray(data.titles) ? data.titles : [];
    return titles
      .map((candidate) => ({ candidate, score: scoreTitleMatch(candidate, title, author) }))
      .sort((a, b) => b.score - a.score)[0]?.candidate || null;
  }

  private async getAvailabilityByIdentifier(
    identifier: { ISBN: string } | { BRN: string },
    source: NlbAvailabilityResult["source"],
    matchedTitle?: NlbTitle
  ): Promise<NlbAvailabilityResult> {
    const params = new URLSearchParams({ ...identifier, Limit: "100", SortFields: "+locationCode" });
    const data = await this.request<{ items?: NlbAvailabilityApiItem[]; totalRecords?: number }>("/GetAvailabilityInfo", params).catch((error) => {
      if (error instanceof NlbCatalogueError && error.status === 404) return { items: [], totalRecords: 0 };
      throw error;
    });
    const items = Array.isArray(data.items) ? data.items.map(mapAvailabilityItem) : [];

    return {
      matched: items.length > 0 || Boolean(matchedTitle),
      source,
      checkedAt: new Date().toISOString(),
      matchedTitle: matchedTitle ? mapMatchedTitle(matchedTitle) : undefined,
      totalItems: typeof data.totalRecords === "number" ? data.totalRecords : items.length,
      availableItems: items.filter((item) => item.isAvailable).length,
      items,
    };
  }

  private async request<T>(path: string, params: URLSearchParams): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}?${params}`, {
      headers: {
        "X-Api-Key": this.apiKey,
        "X-App-Code": this.appCode,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new NlbCatalogueError(body.message || "NLB Catalogue request failed", response.status);
    }

    return response.json();
  }
}

export class NlbCatalogueError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NlbCatalogueError";
    this.status = status;
  }
}

export function normalizeIsbn(isbn: string | null | undefined) {
  const compact = String(isbn || "").replace(/[^0-9Xx]/g, "");
  return ISBN_PATTERN.test(compact) ? compact : "";
}

function emptyAvailability(source: NlbAvailabilityResult["source"]): NlbAvailabilityResult {
  return {
    matched: false,
    source,
    checkedAt: new Date().toISOString(),
    totalItems: 0,
    availableItems: 0,
    items: [],
  };
}

function mapAvailabilityItem(item: NlbAvailabilityApiItem): NlbAvailabilityItem {
  const statusName = item.status?.name || "Unknown";
  const statusCode = item.status?.code || null;
  const transactionStatusCode = item.transactionStatus?.code || null;
  const transactionStatusName = item.transactionStatus?.name || null;

  return {
    itemId: item.itemId || null,
    branchCode: item.location?.code || null,
    branchName: item.location?.name || "Unknown branch",
    statusCode,
    statusName,
    transactionStatusCode,
    transactionStatusName,
    callNumber: item.formattedCallNumber || item.callNumber || null,
    isAvailable:
      Boolean(transactionStatusCode && AVAILABLE_TRANSACTION_CODES.has(transactionStatusCode)) ||
      AVAILABLE_STATUS_NAMES.has(statusName.toLowerCase()) ||
      Boolean(transactionStatusName && AVAILABLE_STATUS_NAMES.has(transactionStatusName.toLowerCase())),
  };
}

function mapMatchedTitle(title: NlbTitle) {
  return {
    brn: title.brn || null,
    title: title.title || null,
    author: title.author || null,
    isbns: title.isbns || [],
  };
}

function scoreTitleMatch(candidate: NlbTitle, title: string, author: string) {
  const candidateTitle = cleanBookKey(candidate.title);
  const targetTitle = cleanBookKey(title);
  const candidateAuthor = cleanBookKey(candidate.author);
  const targetAuthor = cleanBookKey(author);
  let score = 0;

  if (candidateTitle === targetTitle) score += 80;
  else if (candidateTitle.includes(targetTitle) || targetTitle.includes(candidateTitle)) score += 45;
  if (targetAuthor && (candidateAuthor.includes(targetAuthor) || targetAuthor.includes(candidateAuthor))) score += 30;

  return score;
}
