import Link from "next/link";
import {
  BuildingsIcon,
  CompareIcon,
  SparklesIcon,
  AwardIcon,
  ClipboardIcon,
  ChatIcon,
} from "@/components/icons";
import { quickActions } from "@/data/home";

const iconMap = {
  buildings: BuildingsIcon,
  compare: CompareIcon,
  sparkles: SparklesIcon,
  award: AwardIcon,
  clipboard: ClipboardIcon,
  chat: ChatIcon,
};

const accentClasses = [
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-teal-100 text-teal-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
];

export default function QuickActions() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action, index) => {
          const Icon = iconMap[action.icon];
          const accent = accentClasses[index % accentClasses.length];
          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-start gap-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                <Icon className="h-6 w-6" />
              </span>
              <span>
                <span className="block text-base font-semibold text-neutral-950">
                  {action.label}
                </span>
                <span className="mt-1 block text-sm leading-6 text-neutral-500">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}