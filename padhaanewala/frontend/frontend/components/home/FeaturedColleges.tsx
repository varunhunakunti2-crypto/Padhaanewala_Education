import type { College } from "@/lib/types";
import { CollegeCard } from "@/components/college/CollegeCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRight, Compass } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

export function FeaturedColleges({ colleges: dataset }: { colleges: College[] }) {
  const featured = dataset.filter((c) => c.featured);
  const topRated = [...dataset]
    .sort((a, b) => b.rating - a.rating)
    .filter((c) => !featured.some((f) => f.id === c.id))
    .slice(0, 6);
  const colleges = [...featured, ...topRated].slice(0, 9);

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <SectionHeading
        eyebrowTone="cool"
        eyebrow="Discover"
        title="Explore Colleges"
        description="Discover colleges that match your goals — shortlist the ones you love."
        action={
          <ButtonLink href="/colleges" variant="outline" size="sm">
            View all colleges <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {colleges.map((college, i) => (
          <Reveal key={college.id} delay={(i % 3) * 0.07}>
            <CollegeCard college={college} />
          </Reveal>
        ))}
      </div>
      <div className="mt-8 flex justify-center lg:hidden">
        <ButtonLink href="/colleges" variant="outline" size="md">
          <Compass className="h-4 w-4" /> View all colleges
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </section>
  );
}