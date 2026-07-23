import type { RecipeMetadata } from "@codeshift/platform";
import type { PaginatedResponse } from "./api-contract";

export class CodeShiftApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async health(): Promise<{ status: string; version: string }> {
    return this.get("/api/v1/health/live");
  }

  async recipes(input: {
    page?: number;
    pageSize?: number;
    filter?: string;
    sort?: "asc" | "desc";
  } = {}): Promise<PaginatedResponse<RecipeMetadata>> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return this.get(`/api/v1/recipes?${query}`);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`CodeShift API request failed with ${response.status}.`);
    return response.json() as Promise<T>;
  }
}
