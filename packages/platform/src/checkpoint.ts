import { createHash } from "node:crypto";

export interface CheckpointFile {
  path: string;
  content: string;
}

export interface Checkpoint {
  id: string;
  campaignId: string;
  stageId: string;
  gitCommit?: string;
  files: Array<{ path: string; hash: string }>;
  dependencyLockfiles: Array<{ path: string; hash: string }>;
  configuration: Record<string, string>;
  validationBaseline: Record<string, "PASSED" | "FAILED" | "SKIPPED">;
  createdAt: string;
}

interface StoredCheckpoint {
  metadata: Checkpoint;
  contents: Map<string, string>;
}

export class InMemoryCheckpointStore {
  private readonly checkpoints = new Map<string, StoredCheckpoint>();

  create(input: {
    id: string;
    campaignId: string;
    stageId: string;
    gitCommit?: string;
    files: readonly CheckpointFile[];
    dependencyLockfiles?: readonly CheckpointFile[];
    configuration?: Readonly<Record<string, string>>;
    validationBaseline?: Readonly<
      Record<string, "PASSED" | "FAILED" | "SKIPPED">
    >;
    createdAt?: string;
  }): Checkpoint {
    if (this.checkpoints.has(input.id)) {
      throw new Error(`Checkpoint ${input.id} already exists.`);
    }

    const contents = new Map(
      [...input.files, ...(input.dependencyLockfiles ?? [])].map((file) => [
        normalizePath(file.path),
        file.content,
      ]),
    );
    const metadata: Checkpoint = {
      id: input.id,
      campaignId: input.campaignId,
      stageId: input.stageId,
      gitCommit: input.gitCommit,
      files: input.files.map(hashFile),
      dependencyLockfiles: (input.dependencyLockfiles ?? []).map(hashFile),
      configuration: { ...(input.configuration ?? {}) },
      validationBaseline: { ...(input.validationBaseline ?? {}) },
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.checkpoints.set(input.id, { metadata, contents });
    return structuredClone(metadata);
  }

  get(id: string): Checkpoint | undefined {
    const stored = this.checkpoints.get(id);
    return stored ? structuredClone(stored.metadata) : undefined;
  }

  verify(id: string, currentFiles: readonly CheckpointFile[]): {
    valid: boolean;
    changedFiles: string[];
  } {
    const stored = this.require(id);
    const currentHashes = new Map(
      currentFiles.map((file) => [normalizePath(file.path), hash(file.content)]),
    );
    const changedFiles = stored.metadata.files
      .filter((file) => currentHashes.get(file.path) !== file.hash)
      .map((file) => file.path);
    return { valid: changedFiles.length === 0, changedFiles };
  }

  restore(id: string, approvedBy: string): {
    checkpoint: Checkpoint;
    approvedBy: string;
    files: CheckpointFile[];
  } {
    if (!approvedBy.trim()) {
      throw new Error("Checkpoint restore requires an approving actor.");
    }
    const stored = this.require(id);
    return {
      checkpoint: structuredClone(stored.metadata),
      approvedBy,
      files: [...stored.contents.entries()].map(([path, content]) => ({
        path,
        content,
      })),
    };
  }

  exportPatch(id: string, currentFiles: readonly CheckpointFile[]): string {
    const stored = this.require(id);
    const current = new Map(
      currentFiles.map((file) => [normalizePath(file.path), file.content]),
    );
    return stored.metadata.files
      .filter((file) => current.get(file.path) !== stored.contents.get(file.path))
      .map((file) => {
        const before = stored.contents.get(file.path) ?? "";
        const after = current.get(file.path) ?? "";
        return [
          `--- a/${file.path}`,
          `+++ b/${file.path}`,
          `-checkpoint:${hash(before)}`,
          `+current:${hash(after)}`,
        ].join("\n");
      })
      .join("\n");
  }

  private require(id: string): StoredCheckpoint {
    const stored = this.checkpoints.get(id);
    if (!stored) throw new Error(`Checkpoint ${id} was not found.`);
    return stored;
  }
}

function hashFile(file: CheckpointFile): { path: string; hash: string } {
  return { path: normalizePath(file.path), hash: hash(file.content) };
}

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe checkpoint path: ${path}`);
  }
  return normalized;
}
