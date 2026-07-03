import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Clock3,
  FileCode2,
  Paintbrush,
  RefreshCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const recipes = [
  {
    label: "JavaScript → TypeScript",
    detail: "Types, config, imports, and safe module boundaries.",
    state: "Active",
    icon: Braces,
    active: true,
  },
  {
    label: "Express → Hono",
    detail: "Route and middleware modernization for edge runtimes.",
    state: "Coming soon",
    icon: RefreshCcw,
  },
  {
    label: "React classes → hooks",
    detail: "Lifecycle and state refactors with behavior checks.",
    state: "Coming soon",
    icon: FileCode2,
  },
  {
    label: "CSS → Tailwind",
    detail: "Utility extraction while preserving visual output.",
    state: "Coming soon",
    icon: Paintbrush,
  },
  {
    label: "Callbacks → async/await",
    detail: "Control-flow cleanup with error-path preservation.",
    state: "Coming soon",
    icon: ArrowRight,
  },
];

export function RecipesSection() {
  return (
    <section
      id="recipes"
      className="scroll-mt-16 border-b border-border bg-surface"
    >
      <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-28">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <Badge>Migration recipes</Badge>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Purpose-built playbooks for recurring codebase shifts.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-text-secondary">
            Each recipe will bundle analysis rules, patch strategies, and
            validation checks for one migration shape.
          </p>
        </div>

        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => {
            const Icon = recipe.icon;
            return (
              <article
                key={recipe.label}
                className={`rounded-[12px] border p-5 ${
                  recipe.active
                    ? "border-primary/35 bg-primary/[0.045]"
                    : "border-border bg-background"
                } ${index === 0 ? "md:col-span-2 lg:col-span-1" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex size-10 items-center justify-center rounded-[10px] border ${
                      recipe.active
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-border bg-surface text-text-secondary"
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
                      recipe.active ? "text-success" : "text-text-muted"
                    }`}
                  >
                    {recipe.active ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <Clock3 className="size-3" />
                    )}
                    {recipe.state}
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-semibold text-text-primary">
                  {recipe.label}
                </h3>
                <p className="mt-2 text-xs leading-5 text-text-secondary">
                  {recipe.detail}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
