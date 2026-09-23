export type ExecutionPlatform = "windows-powershell" | "macos-linux";

export interface ExecutionPrerequisite {
  id: string;
  title: string;
  description: string;
}

export interface ExecutionStep {
  order: number;
  id: string;
  title: string;
  command: string;
  description: string;
  workingDirectory?: string;
  expectedOutput?: string;
  blocking: boolean;
  copyable: boolean;
}

export interface ExecutionAction {
  id: string;
  title: string;
  description: string;
  href?: string;
}

export interface CampaignExecutionGuide {
  campaignId: string;
  recipeId: string;
  recipeName: string;
  platform: ExecutionPlatform;
  prerequisites: ExecutionPrerequisite[];
  steps: ExecutionStep[];
  validationSteps: ExecutionStep[];
  rollbackSteps: ExecutionStep[];
  expectedChangedFiles: string[];
  nextActions: ExecutionAction[];
  troubleshooting: string[];
}
