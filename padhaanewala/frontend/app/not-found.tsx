import { FileQuestion, ArrowRight, Home } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-purple-100 text-purple-600">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight text-purple-950">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-gray-500">
        We could not find the page you are looking for. It may have been moved or the URL may be incorrect.
      </p>
      <div className="mt-6 flex gap-3">
        <ButtonLink href="/" variant="accent" size="md">
          <Home className="h-4 w-4" /> Go to homepage
        </ButtonLink>
        <ButtonLink href="/colleges" variant="secondary" size="md">
          Browse colleges <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </section>
  );
}