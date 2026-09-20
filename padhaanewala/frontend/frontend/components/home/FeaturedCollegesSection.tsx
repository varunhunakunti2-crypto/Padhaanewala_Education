"use client";

import Link from "next/link";
import { MapPin, Star, Heart, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/context/AppContext";

const FEATURED_COLLEGES = [
  {
    id: "c01",
    slug: "iit-bombay",
    name: "IIT Bombay",
    city: "Mumbai",
    state: "Maharashtra",
    rating: 4.8,
    reviews: "12.4K reviews",
    tags: ["Engineering", "Research"],
    image: "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&h=400&q=80",
  },
  {
    id: "c06",
    slug: "delhi-university",
    name: "Delhi University",
    city: "New Delhi",
    state: "Delhi",
    rating: 4.6,
    reviews: "10.9K reviews",
    tags: ["Arts", "Commerce"],
    image: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=600&h=400&q=80",
  },
  {
    id: "c18",
    slug: "christ-university",
    name: "Christ University",
    city: "Bangalore",
    state: "Karnataka",
    rating: 4.5,
    reviews: "11.2K reviews",
    tags: ["Management", "Liberal Arts"],
    image: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?auto=format&fit=crop&w=600&h=400&q=80",
  },
  {
    id: "c03",
    slug: "bits-pilani",
    name: "BITS Pilani",
    city: "Pilani",
    state: "Rajasthan",
    rating: 4.7,
    reviews: "9.2K reviews",
    tags: ["Engineering", "Science"],
    image: "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?auto=format&fit=crop&w=600&h=400&q=80",
  },
  {
    id: "c08",
    slug: "aiims-delhi",
    name: "AIIMS Delhi",
    city: "New Delhi",
    state: "Delhi",
    rating: 4.9,
    reviews: "14.6K reviews",
    tags: ["Medical", "Research"],
    image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=600&h=400&q=80",
  },
];

export function FeaturedCollegesSection() {
  const { isSaved, toggleSave } = useApp();

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            Featured Colleges
          </h2>
          <p className="mt-1 text-sm text-gray-500 sm:text-[15px]">
            Top-rated institutions based on academics, placements and student reviews.
          </p>
        </div>
        <Link
          href="/colleges"
          className="group inline-flex items-center gap-1 text-sm font-semibold text-purple-700 transition hover:text-purple-900"
        >
          View All{" "}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* 5 Colleges Grid */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {FEATURED_COLLEGES.map((college) => {
          const saved = isSaved(college.id);
          return (
            <div
              key={college.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg"
            >
              {/* College Campus Photo */}
              <div className="relative h-40 w-full overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={college.image}
                  alt={college.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Heart save button */}
                <button
                  aria-label={saved ? `Remove ${college.name} from saved` : `Save ${college.name}`}
                  onClick={() => toggleSave(college.id, college.name)}
                  className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full bg-white/85 text-gray-500 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:text-red-500"
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${
                      saved ? "fill-red-500 text-red-500" : "text-gray-600"
                    }`}
                  />
                </button>
              </div>

              {/* Card Details */}
              <div className="flex flex-1 flex-col p-4">
                <Link
                  href={`/colleges/${college.slug}`}
                  className="font-display text-[16px] font-bold text-gray-900 transition-colors hover:text-purple-700 line-clamp-1"
                >
                  {college.name}
                </Link>

                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  {college.city}, {college.state}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                  <span className="flex items-center gap-1 text-amber-500">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {college.rating}
                  </span>
                  <span className="font-normal text-gray-400">({college.reviews})</span>
                </div>

                {/* Badges */}
                <div className="mt-3.5 flex flex-wrap gap-1.5 pt-1">
                  {college.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-purple-100 bg-purple-50/70 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
