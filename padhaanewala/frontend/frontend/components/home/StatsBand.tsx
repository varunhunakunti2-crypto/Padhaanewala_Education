import { Building2, GraduationCap, IndianRupee, Users } from "lucide-react";
import { CountUp } from "@/components/ui/CountUp";

const STATS = [
  { icon: Building2, to: 1400, suffix: "+", label: "Colleges listed", color: "bg-purple-50 text-purple-600" },
  { icon: GraduationCap, to: 18000, suffix: "+", label: "Courses across streams", color: "bg-blue-50 text-blue-600" },
  { icon: IndianRupee, to: 2400000, prefix: "₹", label: "Avg. highest package", color: "bg-amber-50 text-amber-600" },
  { icon: Users, to: 240000, suffix: "+", label: "Students each month", color: "bg-orange-50 text-orange-600" },
];

export function StatsBand() {
  return (
    <section className="border-y border-purple-100/60 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${s.color}`}>
                <s.icon className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <div>
                <dt className="order-2 text-[13px] font-medium text-gray-500">{s.label}</dt>
                <dd className="font-display order-1 text-2xl font-extrabold tracking-tight text-gray-900 tabular-nums">
                  <CountUp to={s.to} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}