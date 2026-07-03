import Link from "next/link";
import { ArrowRight, Braces, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ProductPreview } from "./ProductPreview";

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-text-primary"
      aria-label="CodeShift AI home"
    >
      <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
        <Braces aria-hidden="true" className="size-4" strokeWidth={2.4} />
      </span>
      <span>
        CodeShift <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-fade grid-surface pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-[1240px] px-5 sm:px-8">
        <nav
          className="flex h-16 items-center justify-between"
          aria-label="Main navigation"
        >
          <Logo />
          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#workflow"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              Workflow
            </a>
            <a
              href="#comparison"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              Why CodeShift AI
            </a>
            <a
              href="#recipes"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              Recipes
            </a>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard"
              className={buttonVariants({
                size: "sm",
                className: "hidden sm:inline-flex",
              })}
            >
              Open workspace
            </Link>
          </div>
        </nav>

        <div className="grid items-center gap-14 pb-20 pt-16 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:gap-12 lg:pb-28 lg:pt-24">
          <div className="min-w-0 max-w-[640px]">
            <Badge tone="primary" className="mb-6">
              Review-first migration engine
            </Badge>
            <h1 className="text-balance text-[2.75rem] font-semibold leading-[1.04] tracking-tightest text-text-primary sm:text-[3.75rem] lg:text-[4rem]">
              Ship safer code migrations, one reviewable PR at a time.
            </h1>
            <p className="mt-6 max-w-[610px] text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">
              CodeShift AI analyzes legacy JavaScript repositories, generates
              TypeScript migration plans, applies scoped refactors, runs
              validation, and opens clean pull requests with human approval.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className={buttonVariants({ size: "lg" })}
              >
                Analyze a repo
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <a
                href="#demo"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                <PlayCircle aria-hidden="true" className="size-4" />
                View demo migration
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-text-muted">
              <span>SCOPED PATCHES</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>VALIDATION GATES</span>
              <span className="hidden h-3 w-px bg-border sm:block" />
              <span>HUMAN APPROVAL</span>
            </div>
          </div>

          <div id="demo" className="relative min-w-0 scroll-mt-24">
            <div className="absolute -inset-5 -z-10 rounded-[28px] bg-primary/[0.04]" />
            <ProductPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
