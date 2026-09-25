"use client";


import {
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/context/AppContext";
import { COLLEGES } from "@/lib/data";

import { SectionHeading, AddButton, IconAction } from "@/components/admin/primitives";

export function MediaSection() {
  const { showToast } = useApp();
  return (
    <div>
      <SectionHeading title="Media library" description="College logos, banners and campus imagery" action={<AddButton label="Upload" />} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {COLLEGES.slice(0, 8).map((c) => (
          <div key={c.id} className="group overflow-hidden rounded-xl border border-slate-100">
            <div className="grid h-24 place-items-center bg-gradient-to-br from-purple-700 to-indigo-600 text-white">
              <span className="text-sm font-bold">{c.initials}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-600">{c.shortName}</p>
              <IconAction
                title="Remove media"
                onClick={() => showToast({ title: "Remove media", description: `${c.shortName} asset removed from the library.`, variant: "info" })}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconAction>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
