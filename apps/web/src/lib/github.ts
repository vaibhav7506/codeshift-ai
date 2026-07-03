import type { RepositoryFileEntry } from "@codeshift/analyzer";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PACKAGE_JSON_BYTES = 512_000;
const MAX_SAMPLE_BYTES = 128_000;
const MAX_SOURCE_SAMPLES = 8;

type GitHubErrorCode =
  | "REPO_NOT_FOUND"
  | "RATE_LIMITED"
  | "PACKAGE_JSON_MISSING"
  | "REPOSITORY_TOO_LARGE"
  | "GITHUB_API_ERROR";

interface GitHubRepositoryResponse {
  default_branch: string;
  html_url: string;
  private: boolean;
}

interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

interface GitHubTreeResponse {
  truncated: boolean;
  tree: GitHubTreeEntry[];
}

interface GitHubBlobResponse {
  content: string;
  encoding: string;
  size: number;
}

interface GitHubErrorResponse {
  message?: string;
}

export interface FetchedGitHubRepository {
  repoUrl: string;
  defaultBranch: string;
  fileTree: RepositoryFileEntry[];
  packageJsonText: string;
}

export class GitHubApiError extends Error {
  constructor(
    readonly code: GitHubErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export async function fetchPublicGitHubRepository(
  owner: string,
  repo: string,
): Promise<FetchedGitHubRepository> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const metadata = await githubRequest<GitHubRepositoryResponse>(
    `/repos/${encodedOwner}/${encodedRepo}`,
  );

  if (metadata.private) {
    throw new GitHubApiError(
      "REPO_NOT_FOUND",
      "Only public GitHub repositories can be analyzed.",
      404,
    );
  }

  const defaultBranch = metadata.default_branch;
  const tree = await githubRequest<GitHubTreeResponse>(
    `/repos/${encodedOwner}/${encodedRepo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
  );

  if (tree.truncated) {
    throw new GitHubApiError(
      "REPOSITORY_TOO_LARGE",
      "This repository is too large for a safe hosted analysis.",
      422,
    );
  }

  const packageEntry = tree.tree.find(
    (entry) => entry.type === "blob" && entry.path === "package.json",
  );

  if (!packageEntry) {
    throw new GitHubApiError(
      "PACKAGE_JSON_MISSING",
      "No root package.json was found in this repository.",
      422,
    );
  }

  if ((packageEntry.size ?? 0) > MAX_PACKAGE_JSON_BYTES) {
    throw new GitHubApiError(
      "GITHUB_API_ERROR",
      "The repository package.json is too large to analyze safely.",
      422,
    );
  }

  const packageJsonText = await fetchBlobText(
    encodedOwner,
    encodedRepo,
    packageEntry.sha,
  );
  const sourceSamples = selectSourceSamples(tree.tree);
  const sampledContents = await Promise.allSettled(
    sourceSamples.map(async (entry) => ({
      path: entry.path,
      content: await fetchBlobText(
        encodedOwner,
        encodedRepo,
        entry.sha,
      ),
    })),
  );
  const sampleRateLimitError = sampledContents.find(
    (result) =>
      result.status === "rejected" &&
      result.reason instanceof GitHubApiError &&
      result.reason.code === "RATE_LIMITED",
  );

  if (sampleRateLimitError?.status === "rejected") {
    throw sampleRateLimitError.reason;
  }

  const contentByPath = new Map(
    sampledContents.flatMap((result) =>
      result.status === "fulfilled"
        ? [[result.value.path, result.value.content] as const]
        : [],
    ),
  );

  const fileTree: RepositoryFileEntry[] = tree.tree.flatMap((entry) => {
    if (entry.type !== "blob" && entry.type !== "tree") {
      return [];
    }

    return [
      {
        path: entry.path,
        type: entry.type,
        size: entry.size,
        content: contentByPath.get(entry.path),
      },
    ];
  });

  return {
    repoUrl: metadata.html_url,
    defaultBranch,
    fileTree,
    packageJsonText,
  };
}

async function githubRequest<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeShift-AI",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await readGitHubError(response);
      const rateLimited =
        response.status === 429 ||
        response.headers.get("x-ratelimit-remaining") === "0" ||
        /rate limit/i.test(error.message ?? "");

      if (rateLimited) {
        const resetAt = response.headers.get("x-ratelimit-reset");
        const resetMessage = resetAt
          ? ` Try again after ${new Date(Number(resetAt) * 1000).toLocaleTimeString()}.`
          : "";

        throw new GitHubApiError(
          "RATE_LIMITED",
          `GitHub's public API rate limit was reached.${resetMessage}`,
          429,
        );
      }

      if (response.status === 404) {
        throw new GitHubApiError(
          "REPO_NOT_FOUND",
          "The public GitHub repository was not found.",
          404,
        );
      }

      throw new GitHubApiError(
        "GITHUB_API_ERROR",
        "GitHub could not provide the repository data right now.",
        502,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new GitHubApiError(
        "GITHUB_API_ERROR",
        "GitHub did not respond before the analysis timeout.",
        504,
      );
    }

    throw new GitHubApiError(
      "GITHUB_API_ERROR",
      "GitHub could not be reached from the analysis service.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBlobText(
  owner: string,
  repo: string,
  sha: string,
): Promise<string> {
  const blob = await githubRequest<GitHubBlobResponse>(
    `/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`,
  );

  if (blob.encoding !== "base64") {
    throw new GitHubApiError(
      "GITHUB_API_ERROR",
      "GitHub returned an unsupported file encoding.",
      502,
    );
  }

  return Buffer.from(blob.content.replace(/\s/g, ""), "base64").toString(
    "utf8",
  );
}

function selectSourceSamples(tree: GitHubTreeEntry[]): GitHubTreeEntry[] {
  const ignoredSegments = new Set([
    "node_modules",
    "dist",
    "build",
    "coverage",
    "vendor",
    ".next",
  ]);
  const preferredSegments = new Set(["utils", "lib", "helpers", "src"]);

  return tree
    .filter((entry) => {
      if (
        entry.type !== "blob" ||
        !/\.(?:js|jsx|mjs|cjs)$/i.test(entry.path) ||
        (entry.size ?? 0) > MAX_SAMPLE_BYTES
      ) {
        return false;
      }

      return !entry.path
        .toLowerCase()
        .split("/")
        .some((segment) => ignoredSegments.has(segment));
    })
    .sort((left, right) => {
      const leftPreferred = left.path
        .toLowerCase()
        .split("/")
        .some((segment) => preferredSegments.has(segment));
      const rightPreferred = right.path
        .toLowerCase()
        .split("/")
        .some((segment) => preferredSegments.has(segment));

      return (
        Number(rightPreferred) - Number(leftPreferred) ||
        (left.size ?? 0) - (right.size ?? 0) ||
        left.path.localeCompare(right.path)
      );
    })
    .slice(0, MAX_SOURCE_SAMPLES);
}

async function readGitHubError(
  response: Response,
): Promise<GitHubErrorResponse> {
  try {
    return (await response.json()) as GitHubErrorResponse;
  } catch {
    return {};
  }
}
