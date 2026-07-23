import type { NextRequest } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, string>;
  };
}

export interface PageMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMetadata;
}

export function paginationFromRequest(
  request: Request | NextRequest,
  maximumPageSize = 100,
): { page: number; pageSize: number; sort: "asc" | "desc"; filter?: string } {
  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get("page"), 1);
  const pageSize = Math.min(maximumPageSize, positiveInteger(url.searchParams.get("pageSize"), 25));
  const sort = url.searchParams.get("sort") === "desc" ? "desc" : "asc";
  const filter = url.searchParams.get("filter")?.trim().slice(0, 100);
  return { page, pageSize, sort, ...(filter ? { filter } : {}) };
}

export function paginate<T>(
  values: readonly T[],
  input: { page: number; pageSize: number },
): PaginatedResponse<T> {
  const start = (input.page - 1) * input.pageSize;
  return {
    data: values.slice(start, start + input.pageSize),
    meta: {
      page: input.page,
      pageSize: input.pageSize,
      total: values.length,
      totalPages: Math.ceil(values.length / input.pageSize),
    },
  };
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
