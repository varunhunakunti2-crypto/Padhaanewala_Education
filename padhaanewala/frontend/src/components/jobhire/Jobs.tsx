"use client";

import { useMemo, useState } from "react";
import { jobFilters, jobs } from "./data";
import { BriefcaseIcon, MapPinIcon } from "./icons";

type Tab = (typeof jobFilters)[number];

const tintPairs = [
  "bg-[#DDEFEF]",
  "bg-[#FFF3C4]",
  "bg-[#FFE3EE]",
  "bg-[#E6F7FE]",
  "bg-[#EDE9FF]",
  "bg-[#EAFBE8]",
];

function CompanyMark({ company, index }: { company: string; index: number }) {
  const initials = company
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-jh-ink ${tintPairs[index % tintPairs.length]}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function JobCard({ index }: { index: number }) {
  const job = jobs[index];
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-jh-line bg-white p-5 shadow-[0_2px_10px_-6px_rgba(7,19,40,0.1)] transition-shadow duration-200 hover:shadow-[0_18px_35px_-20px_rgba(7,19,40,0.25)] sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <CompanyMark company={job.company} index={index} />
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-jh-ink">{job.title}</h3>
          <p className="text-sm font-medium text-jh-green">{job.company}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto">
        <span className="flex items-center gap-1.5 text-sm text-jh-muted">
          <BriefcaseIcon className="h-4 w-4" />
          {job.type}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-jh-muted">
          <MapPinIcon className="h-4 w-4" />
          {job.location}
        </span>
        <span className="text-sm font-semibold text-jh-ink">{job.salary}</span>
        <a
          href="#"
          className="rounded-full border border-jh-ink px-6 py-2 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-jh-ink hover:text-white"
        >
          Apply
        </a>
      </div>
    </article>
  );
}

export default function JobsSection() {
  const [active, setActive] = useState<Tab>("Popular");

  const visibleJobs = useMemo(() => {
    if (active === "Popular") return jobs;
    return jobs.filter((job) => job.type === active);
  }, [active]);

  return (
    <section id="jobs" className="bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-jh-ink">
            Recent Available Jobs
          </h2>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Job filters">
            {jobFilters.map((tab) => {
              const isActive = tab === active;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? "bg-jh-teal text-jh-ink"
                      : "bg-white text-jh-muted hover:bg-jh-teal/40 hover:text-jh-ink"
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-4">
          {visibleJobs.map((job) => (
            <JobCard key={job.id} index={jobs.indexOf(job)} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-full bg-jh-yellow px-7 py-3.5 text-sm font-semibold text-jh-ink transition-colors duration-200 hover:bg-[#FFD93D]"
          >
            Browse more Jobs
          </a>
        </div>
      </div>
    </section>
  );
}