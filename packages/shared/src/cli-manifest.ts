export type CliFlag = {
  name: string;
  value?: string;
  required?: boolean;
  description: string;
};

export type CliCommandDefinition = {
  id: string;
  command: string;
  summary: string;
  usage: string;
  flags: readonly CliFlag[];
  subcommands?: readonly CliCommandDefinition[];
};

export const CLI_BINARY_NAME = "codeshift-ai";

export const CLI_COMMAND_MANIFEST: readonly CliCommandDefinition[] = [
  {
    id: "analyze",
    command: "analyze",
    summary: "Analyze the repository in the current directory",
    usage: `${CLI_BINARY_NAME} analyze`,
    flags: [],
  },
  {
    id: "plan",
    command: "plan",
    summary: "Generate a deterministic migration plan",
    usage: `${CLI_BINARY_NAME} plan --target js-to-ts --path <scope>`,
    flags: [
      { name: "--target", value: "js-to-ts", required: true, description: "Legacy direct migration target" },
      { name: "--path", value: "<scope>", required: true, description: "Approved repository scope" },
    ],
  },
  {
    id: "migrate",
    command: "migrate",
    summary: "Apply a scoped JavaScript to TypeScript migration",
    usage: `${CLI_BINARY_NAME} migrate --target js-to-ts --path <scope> [--ai --provider openai]`,
    flags: [
      { name: "--target", value: "js-to-ts", required: true, description: "Legacy direct migration target" },
      { name: "--path", value: "<scope>", required: true, description: "Approved repository scope" },
      { name: "--ai", description: "Enable optional BYOK review notes" },
      { name: "--provider", value: "openai", description: "AI provider, only with --ai" },
    ],
  },
  {
    id: "validate",
    command: "validate",
    summary: "Run available local validation scripts and save logs",
    usage: `${CLI_BINARY_NAME} validate`,
    flags: [],
  },
  {
    id: "pr",
    command: "pr",
    summary: "Review and create an explicitly approved GitHub pull request",
    usage: `${CLI_BINARY_NAME} pr`,
    flags: [],
  },
  {
    id: "recipe",
    command: "recipe",
    summary: "Scaffold and verify local Recipe SDK projects",
    usage: `${CLI_BINARY_NAME} recipe <create|test|validate|inspect> <recipe-name>`,
    flags: [],
  },
  {
    id: "recipes",
    command: "recipes",
    summary: "List recipes from the built-in registry",
    usage: `${CLI_BINARY_NAME} recipes list`,
    flags: [],
  },
  {
    id: "campaign",
    command: "campaign",
    summary: "Run an approved campaign without changing legacy direct commands",
    usage: `${CLI_BINARY_NAME} campaign <connect|preflight|execute|validate|report|rollback|create-pr> --campaign <campaign-id>`,
    flags: [
      { name: "--campaign", value: "<campaign-id>", required: true, description: "Approved campaign ID" },
    ],
    subcommands: [
      {
        id: "campaign-connect",
        command: "connect",
        summary: "Load an approved campaign using a short-lived token",
        usage: `${CLI_BINARY_NAME} campaign connect --campaign <campaign-id> --token <temporary-token> [--api <url>]`,
        flags: [
          { name: "--campaign", value: "<campaign-id>", required: true, description: "Approved campaign ID" },
          { name: "--token", value: "<temporary-token>", required: true, description: "Short-lived campaign token" },
          { name: "--api", value: "<url>", description: "CodeShift control-plane URL" },
        ],
      },
      ...["preflight", "execute", "validate", "report", "rollback", "create-pr"].map(
        (command): CliCommandDefinition => ({
          id: `campaign-${command}`,
          command,
          summary: `${command.replace("-", " ")} the connected approved campaign`,
          usage: `${CLI_BINARY_NAME} campaign ${command} --campaign <campaign-id>`,
          flags: [
            { name: "--campaign", value: "<campaign-id>", required: true, description: "Approved campaign ID" },
          ],
        }),
      ),
    ],
  },
] as const;

export function cliCommand(id: string): CliCommandDefinition {
  const command = CLI_COMMAND_MANIFEST.find((entry) => entry.id === id);
  if (!command) throw new Error(`CLI command ${id} is not registered.`);
  return command;
}

export function campaignCliCommand(command: string): CliCommandDefinition {
  const definition = cliCommand("campaign").subcommands?.find(
    (entry) => entry.command === command,
  );
  if (!definition) throw new Error(`Campaign CLI command ${command} is not registered.`);
  return definition;
}
