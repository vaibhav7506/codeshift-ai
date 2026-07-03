import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { CTASection } from "@/components/landing/CTASection";
import { Hero } from "@/components/landing/Hero";
import { RecipesSection } from "@/components/landing/RecipesSection";
import { WorkflowSection } from "@/components/landing/WorkflowSection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <WorkflowSection />
      <ComparisonSection />
      <RecipesSection />
      <CTASection />
    </main>
  );
}
