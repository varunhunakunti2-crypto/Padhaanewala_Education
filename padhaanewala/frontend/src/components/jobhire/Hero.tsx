import SearchBar from "./SearchBar";
import { HeroIllustration } from "./icons";

export default function Hero() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid w-full max-w-[1536px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:py-14">
        <div className="max-w-xl">
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-jh-ink sm:text-5xl lg:text-[52px]">
            When Searching for a job{" "}
            <span className="text-jh-ink">don&apos;t go in blind,</span>{" "}
            <span className="underline decoration-jh-yellow decoration-8 underline-offset-4">Research first.</span>
          </h1>

          <div className="mt-9">
            <SearchBar />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[380px] lg:max-w-none">
          <HeroIllustration className="w-full" />
        </div>
      </div>
    </section>
  );
}