import { Card, CardContent } from "@/components/ui/Card";

export default function RecipesLoading() {
  return (
    <Card className="shadow-none">
      <CardContent>
        <p className="text-sm text-text-secondary">Loading migration recipes…</p>
      </CardContent>
    </Card>
  );
}
