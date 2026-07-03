"use client";

import { useState } from "react";
import { CLIQuickstart } from "./CLIQuickstart";
import {
  MigrationStepper,
  type DashboardWorkflowState,
} from "./MigrationStepper";
import { RepositoryAnalyzer } from "./RepositoryAnalyzer";

const initialWorkflow: DashboardWorkflowState = { phase: "IDLE" };

export function DashboardWorkflow() {
  const [workflow, setWorkflow] =
    useState<DashboardWorkflowState>(initialWorkflow);

  return (
    <div className="space-y-5">
      <MigrationStepper workflow={workflow} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <RepositoryAnalyzer onWorkflowChange={setWorkflow} />
        <div>
          <CLIQuickstart />
        </div>
      </div>
    </div>
  );
}
