import { AppStoreBadge, PhoneIllustration, PlayStoreBadge } from "./icons";

export default function AppDownload() {
  return (
    <section id="app" className="overflow-hidden bg-jh-teal/70 py-16 sm:py-20">
      <div className="mx-auto grid w-full max-w-[1536px] items-end gap-10 px-4 sm:px-6 lg:grid-cols-2">
        <div className="pb-2">
          <h2 className="text-3xl font-bold tracking-tight text-jh-ink sm:text-4xl">
            Download the App
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-jh-muted">
            Search for your favourite remote jobs on the go. Download our app on
            the iOS App Store or Android Play Store.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="#" aria-label="Download on the App Store" className="transition-transform duration-200 hover:scale-[1.03]">
              <AppStoreBadge className="h-12 w-auto" />
            </a>
            <a href="#" aria-label="Get it on Google Play" className="transition-transform duration-200 hover:scale-[1.03]">
              <PlayStoreBadge className="h-12 w-auto" />
            </a>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneIllustration />
        </div>
      </div>
    </section>
  );
}