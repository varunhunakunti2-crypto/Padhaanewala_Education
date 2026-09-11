import { careerFeatures } from "./data";
import { CheckIcon, ResumeIllustration } from "./icons";

export function CareerSection() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto grid w-full max-w-[1160px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div className="mx-auto w-full max-w-[430px]">
          <ResumeIllustration className="w-full" />
        </div>

        <div>
          <h2 className="text-3xl font-bold tracking-tight text-jh-ink sm:text-4xl">
            Grow your career
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-jh-muted">
            When an unknown printer took a galley of type and scrambled it to
            make a type specimen book, it has survived not only five centuries,
            but also the leap into electronic typesetting, remaining essentially
            unchanged.
          </p>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {careerFeatures.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 rounded-xl border border-jh-line bg-white p-4 transition-colors duration-200 hover:border-jh-green/50"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-jh-green text-white">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium leading-snug text-jh-ink">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}