import {
  CLI_BINARY_NAME,
  campaignCliCommand,
  type CampaignExecutionGuide,
  type ExecutionPlatform,
  type ExecutionStep,
} from "@codeshift/shared";
import { getRecipeCatalogEntry } from "@codeshift/platform/recipe-catalog-runtime";
import { resolveCampaignRecipe } from "@codeshift/platform/campaign-runtime";
import type { StoredCampaign } from "@/lib/campaign-store";

export function buildExecutionGuide(
  stored: StoredCampaign,
  platform: ExecutionPlatform,
): CampaignExecutionGuide {
  const selected = resolveCampaignRecipe(stored.campaign);
  const recipe = getRecipeCatalogEntry(selected.id);
  if (!recipe) throw new Error("The campaign recipe is no longer registered.");
  const campaignArgument = shellArgument(stored.campaign.id, platform);
  const tokenReference =
    platform === "windows-powershell"
      ? "$env:CODESHIFT_CAMPAIGN_TOKEN"
      : "\"$CODESHIFT_CAMPAIGN_TOKEN\"";
  const command = (action: string) => {
    const usage = campaignCliCommand(action).usage
      .replace("<campaign-id>", campaignArgument)
      .replace(" [--api <url>]", "");
    return action === "connect"
      ? usage.replace("<temporary-token>", tokenReference)
      : usage;
  };
  const repositoryDirectory =
    platform === "windows-powershell"
      ? "'C:\\path\\to\\repository'"
      : "'/path/to/repository'";
  const steps: ExecutionStep[] = [
    step(1, "open-repository", "Open the repository directory",
      platform === "windows-powershell"
        ? `Set-Location -LiteralPath ${repositoryDirectory}`
        : `cd -- ${repositoryDirectory}`,
      "Work from the approved repository clone."),
    step(2, "clean-tree", "Confirm the working tree is clean", "git status --short",
      "Stop if the command prints uncommitted files."),
    step(3, "verify-cli", "Verify the CodeShift CLI", `${CLI_BINARY_NAME} --version`,
      "The repository README uses npm link --workspace=@codeshift/cli after building the CLI workspace."),
    step(4, "set-token", "Set the short-lived campaign token",
      platform === "windows-powershell"
        ? "$env:CODESHIFT_CAMPAIGN_TOKEN = '<temporary-token>'"
        : "export CODESHIFT_CAMPAIGN_TOKEN='<temporary-token>'",
      "Keeps the short-lived credential in the current shell session for sanitized event reporting."),
    step(5, "connect", "Load the approved campaign", command("connect"),
      "Uses a short-lived token once; the token is not saved in campaign metadata."),
    step(6, "preflight", "Run preflight checks", command("preflight"),
      "Verifies approval, recipe availability, scope, and a clean working tree."),
    step(7, "execute", `Execute ${recipe.name}`, command("execute"),
      `Loads ${recipe.id}@${recipe.version} from the approved campaign and creates a checkpoint before changes.`),
    step(8, "report", "Inspect the generated report", command("report"),
      "Shows the changed-file summary and local artifact locations."),
    step(9, "inspect-diff", "Inspect the repository diff", "git diff --stat && git diff",
      "Review every change before validation or pull-request creation."),
    step(10, "create-pr", "Create the migration pull request", command("create-pr"),
      "Uses the existing interactive branch, commit, push, and pull-request confirmations."),
  ];
  if (platform === "windows-powershell") {
    steps[8] = step(9, "inspect-diff", "Inspect the repository diff", "git diff --stat; git diff",
      "Review every change before validation or pull-request creation.");
  }

  return {
    campaignId: stored.campaign.id,
    recipeId: recipe.id,
    recipeName: recipe.name,
    platform,
    prerequisites: [
      {
        id: "approved",
        title: "Approved campaign",
        description: "The campaign must remain approved and its recipe cannot change.",
      },
      {
        id: "cli",
        title: "CodeShift CLI",
        description: "Build and link @codeshift/cli from this workspace using the documented npm workflow.",
      },
      {
        id: "git",
        title: "Git repository",
        description: "Use a clean clone with credentials configured for the target remote.",
      },
    ],
    steps,
    validationSteps: [
      step(1, "validate", "Run recipe validation", command("validate"),
        `Runs the campaign validation contract: ${recipe.validationRequirements.join(", ")}.`),
    ],
    rollbackSteps: [
      step(1, "rollback", "Restore the campaign checkpoint", command("rollback"),
        "Restores only files captured by the campaign checkpoint and records the rollback result."),
    ],
    expectedChangedFiles: [...recipe.filesItMayModify],
    nextActions: [
      {
        id: "final-approval",
        title: "Complete final approval",
        description: "Return to the campaign after the pull request and validation evidence are available.",
        href: `/campaigns/${encodeURIComponent(stored.campaign.id)}`,
      },
    ],
    troubleshooting: [
      "If preflight reports a dirty tree, commit, stash, or remove unrelated changes before retrying.",
      "If the token expires, generate a new short-lived token from this execution page.",
      "If validation fails, inspect the report and use the rollback command before retrying.",
    ],
  };
}

function step(
  order: number,
  id: string,
  title: string,
  command: string,
  description: string,
): ExecutionStep {
  return {
    order,
    id,
    title,
    command,
    description,
    expectedOutput: "A sanitized status summary and local artifact path.",
    blocking: true,
    copyable: true,
  };
}

function shellArgument(value: string, platform: ExecutionPlatform): string {
  if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(value)) {
    throw new Error("Campaign ID cannot be represented safely in a shell command.");
  }
  return platform === "windows-powershell" ? `'${value}'` : `'${value}'`;
}
