import {
  analyzeRepositoryInput,
  parseGitHubRepoUrl,
  RepositoryInputError,
} from "@codeshift/analyzer";
import { NextResponse } from "next/server";
import {
  fetchPublicGitHubRepository,
  GitHubApiError,
} from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  repoUrl: string;
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (!isAnalyzeRequest(body)) {
      return errorResponse(
        "INVALID_REPO_URL",
        "Provide a valid public GitHub repository URL.",
        400,
      );
    }

    const { owner, repo } = parseGitHubRepoUrl(body.repoUrl);
    const repository = await fetchPublicGitHubRepository(owner, repo);
    const analysis = analyzeRepositoryInput({
      repoUrl: repository.repoUrl,
      owner,
      repo,
      defaultBranch: repository.defaultBranch,
      fileTree: repository.fileTree,
      packageJsonText: repository.packageJsonText,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    if (error instanceof RepositoryInputError) {
      return errorResponse(error.code, error.message, 400);
    }

    if (error instanceof GitHubApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    if (error instanceof SyntaxError) {
      return errorResponse(
        "INVALID_REQUEST",
        "The analysis request body is not valid JSON.",
        400,
      );
    }

    console.error("Repository analysis failed", error);
    return errorResponse(
      "ANALYSIS_FAILED",
      "The repository analysis could not be completed.",
      500,
    );
  }
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

function isAnalyzeRequest(value: unknown): value is AnalyzeRequest {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "repoUrl" in value &&
    typeof value.repoUrl === "string" &&
    value.repoUrl.length <= 500
  );
}
