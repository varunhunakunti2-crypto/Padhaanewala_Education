import { stats, type Stat } from "./data";
import { BriefcaseIcon, ShareIcon, UsersIcon } from "./icons";

function StatIcon({ name, className }: { name: Stat["icon"]; className?: string }) {
  switch (name) {
    case "users":
      return <UsersIcon className={className} />;
    case "briefcase":
      return <BriefcaseIcon className={className} />;
    case "share":
      return <ShareIcon className={className} />;
  }
}

export default function StatsBar() {
  return (
    <section className="bg-jh-teal/50 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 rounded-[28px] border border-[#D0DEE0] bg-[#F4FAFA] px-8 py-10 sm:grid-cols-3 sm:gap-4 sm:py-12">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-jh-green shadow-[0_10px_25px_-15px_rgba(7,19,40,0.4)]">
                <StatIcon name={stat.icon} className="h-7 w-7" />
              </span>
              <p className="text-3xl font-bold tracking-tight text-jh-ink">
                {stat.value}
              </p>
              <p className="text-sm text-jh-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}