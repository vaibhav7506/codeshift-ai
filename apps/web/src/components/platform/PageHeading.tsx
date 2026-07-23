import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0 self-start xl:self-auto">{action}</div> : null}
    </div>
  );
}
