"use client";


import {
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/FormField";
import { useApp } from "@/lib/context/AppContext";
import { SITE } from "@/lib/site";

import { Panel, SectionHeading } from "@/components/admin/primitives";

export function SettingsSection() {
  const { showToast } = useApp();
  // Seeded from SITE so the admin console cannot drift from what the public site
  // publishes. It previously offered `support@padhaanewala.com` — an address on
  // a domain the site does not use — as the editable value.
  const fields = [
    { label: "Site name", defaultValue: SITE.name },
    { label: "Support email", defaultValue: SITE.email },
    { label: "Contact phone", defaultValue: SITE.phone },
    { label: "Counselling hours", defaultValue: "Mon–Sat, 9 AM – 8 PM IST" },
  ];
  return (
    <div className="space-y-5">
      <SectionHeading title="Site settings" description="Platform-wide configuration" action={<Button type="button" size="sm" onClick={() => showToast({ title: "Settings saved", description: "Configuration updated.", variant: "success" })}><CheckCircle2 className="h-4 w-4" /> Save changes</Button>} />
      <Panel title="Brand & contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label}>
              <Label>{f.label}</Label>
              <Input defaultValue={f.defaultValue} aria-label={f.label} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Preferences">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Default timezone</Label>
            <Select defaultValue="Asia/Kolkata" aria-label="Default timezone">
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
            </Select>
          </div>
          <div>
            <Label>Number formatting</Label>
            <Select defaultValue="Indian (₹, lakh)" aria-label="Number formatting">
              <option value="Indian (₹, lakh)">Indian (₹, lakh)</option>
              <option value="International ($, K)">International ($, K)</option>
            </Select>
          </div>
        </div>
      </Panel>
    </div>
  );
}
