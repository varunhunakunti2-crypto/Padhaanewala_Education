"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Send,
  CheckCircle2,
  HelpCircle,
  User,
  Phone,
  Mail,
  GraduationCap,
  Building2,
  MapPin,
  Briefcase,
} from "lucide-react";
import { Input, Label, Select } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import {
  ApiError,
  fetchCourseNames,
  fetchStateNames,
  resolveCourseId,
  resolveStateId,
  submitEnquiry,
} from "@/lib/api";

/**
 * Courses offered while the catalogue lookup is in flight.
 *
 * The live list from `/courses` replaces this the moment it answers, so these
 * labels are only what a student sees for the first few hundred milliseconds.
 * `resolveCourseId` is what turns a label into the `course_id` the API stores, so
 * an unmatched label is not an error — the column is nullable and the enquiry
 * still lands.
 */
const FALLBACK_COURSES = [
  "B.Tech",
  "B.E",
  "B.Sc",
  "BCA",
  "MBA",
  "BBA",
  "B.Com",
  "M.Tech",
  "MBBS",
  "BAMS",
  "BHMS",
  "B.Sc Nursing",
  "B.Arch",
  "B.Pharm",
  "BDS",
  "MDS",
  "LLB",
  "BA LLB",
  "CA",
  "CS",
];

/** The same, for states and union territories. */
const FALLBACK_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep",
];

type OptionState =
  | { status: "loading" }
  | { status: "ready"; options: string[] }
  /** The lookup failed, so the field degrades to free text rather than blocking. */
  | { status: "unavailable" };

/**
 * Resolve the live option list for a dropdown, or report that it is unavailable.
 *
 * The caller decides what to render while `loading` (here: the `FALLBACK_*` list,
 * so the field is fillable immediately rather than disabled behind a network
 * round trip). A zero-option dropdown paired with a required validation rule is
 * a form that cannot be submitted, which is the defect this whole mechanism
 * exists to prevent — so failure never resolves to an empty list.
 */
function useOptions(load: () => Promise<string[]>): OptionState {
  const [state, setState] = useState<OptionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    load()
      .then((options) => {
        if (!active) return;
        setState(options.length > 0 ? { status: "ready", options } : { status: "unavailable" });
      })
      .catch(() => {
        if (active) setState({ status: "unavailable" });
      });
    return () => {
      active = false;
    };
  }, [load]);

  return state;
}

const INITIAL = {
  name: "",
  mobile: "",
  email: "",
  course: "",
  preferredCollege: "",
  state: "",
  city: "",
  qualification: "",
  message: "",
};

export function AdmissionForm({ compact = false }: { compact?: boolean }) {
  const { addEnquiry, showToast } = useApp();
  const [form, setForm] = useState(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // `useCallback` keeps these references stable so `useOptions` does not tear
  // down and re-run its effect on every render, which would refetch in a loop.
  const loadCourses = useCallback(() => fetchCourseNames(), []);
  const loadStates = useCallback(() => fetchStateNames(), []);

  const courses = useOptions(loadCourses);
  const states = useOptions(loadStates);

  // Which fields were filled as free text because their lookup failed, so the
  // value can be preserved in the enquiry's message instead of being dropped.
  const freeText = useMemo(
    () => ({
      course: courses.status === "unavailable",
      state: states.status === "unavailable",
    }),
    [courses.status, states.status],
  );

  const set = (key: keyof typeof INITIAL) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Enter your full name";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.course) e.course = "Select or type a course";
    if (!form.state) e.state = "Select or type your state";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const [course_id, state_id] = await Promise.all([
        freeText.course ? Promise.resolve(null) : resolveCourseId(form.course),
        freeText.state ? Promise.resolve(null) : resolveStateId(form.state),
      ]);

      // `EnquiryCreate` has no free-text column for course or state — both are
      // nullable foreign keys. When the lookup that populates the dropdown failed
      // the typed value would otherwise be discarded, so it is prepended to the
      // message the counsellor reads. A lost state on a lead is a lost lead.
      const parts: string[] = [];
      if (freeText.state && form.state) parts.push(`State: ${form.state}`);
      if (freeText.course && form.course) parts.push(`Course: ${form.course}`);
      if (form.message) parts.push(form.message);
      const message = parts.length ? parts.join("\n") : null;

      await submitEnquiry({
        name: form.name,
        mobile: form.mobile,
        email: form.email || null,
        course_id,
        state_id,
        city: form.city || null,
        qualification: form.qualification || null,
        message,
        source: "website_admission_form",
        source_url: typeof window !== "undefined" ? window.location.href : undefined,
        device_type: typeof navigator !== "undefined" && navigator.userAgent.includes("Mobi") ? "mobile" : "desktop",
      });
      addEnquiry(form);
      setForm(INITIAL);
      setSubmitted(true);
      window.setTimeout(() => setSubmitted(false), 4000);
      showToast({ variant: "success", title: "Thank you.", description: "Our counsellor will contact you." });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not submit. Please try again.";
      showToast({ variant: "error", title: "Submission failed", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-green-100 bg-green-50/70 p-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h3 className="mt-4 text-xl font-bold text-gray-900">Thank you.</h3>
        <p className="mt-2 text-sm text-gray-600">Our counsellor will contact you.</p>
        <Button variant="primary" className="mt-6" onClick={() => setSubmitted(false)}>
          Submit another enquiry
        </Button>
      </div>
    );
  }

  const wrapper = compact ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "bg-white";

  return (
    <form onSubmit={submit} noValidate className={wrapper}>
      <div className="space-y-1.5">
        <Label htmlFor="enq-name" className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-purple-500" /> Full name *
        </Label>
        <Input id="enq-name" value={form.name} onChange={set("name")} placeholder="e.g. Rahul Sharma" error={!!errors.name} />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-mobile" className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 text-purple-500" /> Mobile *
        </Label>
        <Input id="enq-mobile" value={form.mobile} onChange={set("mobile")} placeholder="10-digit mobile number" inputMode="numeric" error={!!errors.mobile} />
        {errors.mobile && <p className="text-xs text-red-600">{errors.mobile}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-email" className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 text-purple-500" /> Email (optional)
        </Label>
        <Input id="enq-email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" error={!!errors.email} />
        {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-course" className="flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-purple-500" /> Course of interest *
        </Label>
        {courses.status === "unavailable" ? (
          <>
            <Input
              id="enq-course"
              value={form.course}
              onChange={set("course")}
              placeholder="Type your course, e.g. B.Tech"
              error={!!errors.course}
            />
            <p className="text-xs text-gray-500">
              We could not load the course list, so please type it in.
            </p>
          </>
        ) : (
          <Select id="enq-course" value={form.course} onChange={set("course")} error={!!errors.course}>
            <option value="">Select a course</option>
            {(courses.status === "ready" ? courses.options : FALLBACK_COURSES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        )}
        {errors.course && <p className="text-xs text-red-600">{errors.course}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-college" className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-purple-500" /> Preferred college (optional)
        </Label>
        <Input id="enq-college" value={form.preferredCollege} onChange={set("preferredCollege")} placeholder="e.g. IIT Bombay" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-state" className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-purple-500" /> State *
        </Label>
        {states.status === "unavailable" ? (
          <>
            <Input
              id="enq-state"
              value={form.state}
              onChange={set("state")}
              placeholder="Type your state, e.g. Karnataka"
              error={!!errors.state}
            />
            <p className="text-xs text-gray-500">
              We could not load the state list, so please type it in.
            </p>
          </>
        ) : (
          <Select id="enq-state" value={form.state} onChange={set("state")} error={!!errors.state}>
            <option value="">Select your state</option>
            {(states.status === "ready" ? states.options : FALLBACK_STATES).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        )}
        {errors.state && <p className="text-xs text-red-600">{errors.state}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-city" className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-purple-500" /> City (optional)
        </Label>
        <Input id="enq-city" value={form.city} onChange={set("city")} placeholder="e.g. Bengaluru" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enq-qual" className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-purple-500" /> Qualification (optional)
        </Label>
        <Select id="enq-qual" value={form.qualification} onChange={set("qualification")}>
          <option value="">Select</option>
          <option>Class 10</option>
          <option>Class 12 (Science)</option>
          <option>Class 12 (Commerce)</option>
          <option>Class 12 (Arts)</option>
          <option>Diploma</option>
          <option>Bachelor&apos;s degree</option>
          <option>Master&apos;s degree</option>
        </Select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="enq-message">Message (optional)</Label>
        <textarea
          id="enq-message"
          value={form.message}
          onChange={set("message")}
          rows={3}
          placeholder="Tell us about your goals or questions"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting…
            </span>
          ) : (
            <>
              <Send className="h-4 w-4" /> Submit enquiry
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function AdmissionHelpButton({
  label = "Get Admission Help",
  className,
  size = "md",
}: {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="accent" size={size} className={className} onClick={() => setOpen(true)}>
        <HelpCircle className="h-4 w-4" /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Get Admission Help">
        <p className="mb-5 text-sm text-gray-500">
          Fill in your details and our expert counsellors will help you plan your admission.
        </p>
        <AdmissionForm compact />
      </Modal>
    </>
  );
}