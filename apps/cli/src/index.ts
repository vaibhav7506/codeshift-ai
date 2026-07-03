#!/usr/bin/env node

import { parseArgs } from "node:util";
import { generateMigrationPlan } from "@codeshift/migrator/runtime";
import { migrateJavaScriptToTypeScript } from "@codeshift/migrator/migration-runtime";
import {
  createMigrationAIEnhancement,
  resolveCLIAIConfiguration,
} from "./ai-enhancement.js";
import {
  analyzeLocalRepository,
  LocalRepositoryError,
  readAnalysisArtifact,
  writeAnalysisArtifact,
  writeMigrationPlanArtifact,
} from "./local-repository.js";
import {
  formatAnalysisReport,
  formatHelp,
  formatMigrationReport,
  formatAIEnhancementReport,
  formatPlanReport,
  formatValidationReport,
} from "./output.js";
import { runGitHubPRFlow } from "./github-pr.js";
import { runLocalValidation } from "./validation.js";

const VERSION = "0.1.0";

async function main(): Promise<number> {
  const [command, ...commandArgs] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(formatHelp());
    return 0;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  try {
    if (command === "analyze") {
      return await runAnalyze(commandArgs);
    }

    if (command === "plan") {
      return await runPlan(commandArgs);
    }

    if (command === "migrate") {
      return await runMigrate(commandArgs);
    }

    if (command === "validate") {
      return await runValidate(commandArgs);
    }

    if (command === "pr") {
      return await runPullRequest(commandArgs);
    }

    throw new Error(`Unknown command "${command}". Run codeshift-ai --help.`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The command could not complete.";
    process.stderr.write(`\nCodeShift AI error\n${message}\n\n`);
    return error instanceof LocalRepositoryError ? 2 : 1;
  }
}

async function runAnalyze(args: string[]): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (options.values.help) {
    process.stdout.write(
      "\nUsage:\n  codeshift-ai analyze\n\nAnalyzes the current repository without executing its code.\n\n",
    );
    return 0;
  }

  const cwd = process.cwd();
  const analysis = await analyzeLocalRepository(cwd);
  const artifactPath = await writeAnalysisArtifact(cwd, analysis);
  process.stdout.write(formatAnalysisReport(analysis, artifactPath));
  return 0;
}

async function runPlan(args: string[]): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      target: { type: "string" },
      path: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (options.values.help) {
    process.stdout.write(
      "\nUsage:\n  codeshift-ai plan --target js-to-ts --path <scope>\n\nGenerates a plan without modifying source files or running validation.\n\n",
    );
    return 0;
  }

  if (options.values.target !== "js-to-ts") {
    throw new Error('The supported target is "--target js-to-ts".');
  }

  if (!options.values.path?.trim()) {
    throw new Error('Provide a repository scope with "--path <scope>".');
  }

  const cwd = process.cwd();
  let analysis = await readAnalysisArtifact(cwd);
  const analysisWasGenerated = analysis === null;

  if (!analysis) {
    analysis = await analyzeLocalRepository(cwd);
    await writeAnalysisArtifact(cwd, analysis);
  }

  const plan = generateMigrationPlan({
    analysis,
    selectedScope: options.values.path,
  });
  const artifactPath = await writeMigrationPlanArtifact(cwd, plan);
  process.stdout.write(
    formatPlanReport(plan, artifactPath, analysisWasGenerated),
  );
  return 0;
}

async function runMigrate(args: string[]): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      target: { type: "string" },
      path: { type: "string" },
      ai: { type: "boolean" },
      provider: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (options.values.help) {
    process.stdout.write(
      "\nUsage:\n  codeshift-ai migrate --target js-to-ts --path <scope> [--ai --provider openai]\n\nMigrates the selected scope and optionally adds BYOK-powered review notes without committing changes.\n\n",
    );
    return 0;
  }

  if (options.values.target !== "js-to-ts") {
    throw new Error('The supported target is "--target js-to-ts".');
  }

  if (!options.values.path?.trim()) {
    throw new Error('Provide a repository scope with "--path <scope>".');
  }

  if (options.values.provider && !options.values.ai) {
    throw new Error('"--provider" can only be used together with "--ai".');
  }

  const aiConfiguration = options.values.ai
    ? resolveCLIAIConfiguration(options.values.provider)
    : null;
  const cwd = process.cwd();
  const result = await migrateJavaScriptToTypeScript({
    rootDir: cwd,
    selectedScope: options.values.path,
  });
  process.stdout.write(formatMigrationReport(result));

  if (aiConfiguration) {
    try {
      const enhancement = await createMigrationAIEnhancement(
        cwd,
        result,
        aiConfiguration,
      );
      process.stdout.write(formatAIEnhancementReport(enhancement));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The AI request could not be completed.";
      throw new Error(
        `Deterministic migration completed, but AI enhancement failed: ${message}`,
      );
    }
  }

  return 0;
}

async function runValidate(args: string[]): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (options.values.help) {
    process.stdout.write(
      "\nUsage:\n  codeshift-ai validate\n\nRuns only the test, build, typecheck, and lint scripts defined in package.json.\n\n",
    );
    return 0;
  }

  const result = await runLocalValidation(process.cwd());
  process.stdout.write(formatValidationReport(result));
  return result.overallPassed ? 0 : 1;
}

async function runPullRequest(args: string[]): Promise<number> {
  const options = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (options.values.help) {
    process.stdout.write(
      "\nUsage:\n  codeshift-ai pr\n\nReviews migration artifacts and asks separately before creating a branch, committing, pushing, and opening a GitHub pull request.\n\n",
    );
    return 0;
  }

  await runGitHubPRFlow({ cwd: process.cwd() });
  return 0;
}

process.exitCode = await main();
