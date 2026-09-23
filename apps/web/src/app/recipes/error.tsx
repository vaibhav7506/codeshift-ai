"use client";

import { Card, CardContent } from "@/components/ui/Card";

export default function RecipesError({ reset }: { reset: () => void }) {
  return (
    <Card className="shadow-none">
      <CardContent>
        <p role="alert" className="text-sm font-medium text-danger">
          The recipe registry could not be loaded.
        </p>
        <button type="button" onClick={reset} className="mt-3 text-xs font-medium text-primary">
          Try again
        </button>
      </CardContent>
    </Card>
  );
}
