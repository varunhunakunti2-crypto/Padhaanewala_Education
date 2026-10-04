"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/lib/context/AppContext";
import {
  adminApi,
  type AdminCourse,
  type AdminDistrict,
  type AdminState,
  type AdminUniversity,
} from "@/lib/api";
import type { ApiCollegeListItem } from "@/lib/api-server";
import {
  EMPTY_COLLEGE_FORM,
  buildCollegePayload,
  collegeFormFromDetail,
  collegeRefFor,
  describeCollegeError,
  type CollegeFormValues,
} from "@/lib/college-form";
import { useAdminResource } from "@/components/admin/useAdminResource";

import { SectionHeading, IconAction, FilterChips } from "@/components/admin/primitives";
import { CollegeFormFields } from "@/components/admin/sections/CollegeForm";

/** A display row: `DataTable` needs a string `id`, the API's is a number. */
interface CollegeRow extends Omit<ApiCollegeListItem, "id"> {
  id: string;
  record: ApiCollegeListItem;
}

type Dialog =
  | { mode: "create" }
  | { mode: "update"; ref: string; label: string }
  | null;

interface Lookups {
  states: AdminState[];
  districts: AdminDistrict[];
  universities: AdminUniversity[];
  courses: AdminCourse[];
}

/**
 * Colleges, with create / edit / delete against the real catalogue API.
 *
 * This table used to render a bundled demo array, and then a read-only view of
 * `GET /colleges`. Three things it got wrong that only a live contract exposes:
 *
 *  1. **It asked for `limit=1000` and the API caps at 100.** The 422 was
 *     indistinguishable from an unreachable server, so the panel rendered
 *     "Could not reach the colleges API" on every load and read as a backend
 *     outage rather than a bad query. `adminApi.colleges()` now walks the
 *     offsets under a page size held against the real `le=` bound by a test.
 *  2. **It showed the first 100 of 331 colleges and called it the count.** There
 *     is no admin-only listing and no `include_inactive` on this route, so the
 *     walk is the only way an admin can reach every record.
 *  3. **`RowActions` was a toast.** Every row offered View, Edit and Delete,
 *     none of which touched anything. An affordance that claims an action and
 *     performs none is worse than no affordance.
 *
 * The write contract is the rest of the story, and it is lopsided:
 * `POST /colleges` and `PUT /colleges/{ref}` take *different* schemas, the path
 * key is the numeric primary key rather than the `COLLEGE000042` code shown in
 * the table, duplicate names come back as a 400 rather than a 409, and `PUT`
 * nulls any column sent explicitly as null. `lib/college-form.ts` owns all four
 * so they can be tested without a DOM.
 */
export function CollegesSection() {
  const { showToast, roles } = useApp();
  const [sector, setSector] = useState<"Government" | "Private" | "all">("all");

  const { data, error, loading, reload } = useAdminResource<ApiCollegeListItem[]>(
    () => adminApi.colleges(),
    { unreachableMessage: "Could not reach the colleges API." },
  );

  // Mirrors the backend rather than the UI: POST and PUT accept `admin` or
  // `super_admin`, DELETE accepts `super_admin` only. A plain admin is shown a
  // read-only table with no delete control, rather than a button that 403s.
  const canWrite = roles.includes("admin") || roles.includes("super_admin");
  const canDelete = roles.includes("super_admin");

  const [dialog, setDialog] = useState<Dialog>(null);
  /**
   * `null` until the record has actually been fetched. `PUT` nulls any column it
   * receives as null, so submitting a form that was never filled from the
   * server would clear every optional field on the record. The edit dialog stays
   * in its loading state instead.
   */
  const [values, setValues] = useState<CollegeFormValues | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [lookupsError, setLookupsError] = useState<string | null>(null);
  const [districtState, setDistrictState] = useState<{
    stateId: number;
    rows: AdminDistrict[];
  } | null>(null);

  // States, universities and courses are only needed to populate a form, and
  // they are three paged walks. Fetching them when the dialog opens keeps the
  // table's own load to one request.
  useEffect(() => {
    if (dialog === null || lookups !== null) return;
    let ignore = false;
    Promise.all([adminApi.states(), adminApi.universities(), adminApi.courses()])
      .then(([states, universities, courses]) => {
        if (ignore) return;
        setLookups({ states, districts: [], universities, courses });
      })
      .catch((err: unknown) => {
        if (ignore) return;
        // The form stays usable: only `name` is required, and every lookup has an
        // explicit "Not recorded". Swallowing this silently would present an
        // empty dropdown as "there are no states".
        setLookupsError(describeCollegeError(err));
        setLookups({ states: [], districts: [], universities: [], courses: [] });
      });
    return () => {
      ignore = true;
    };
  }, [dialog, lookups]);

  // Districts belong to a state, and the backend nulls `district_id` when the
  // two disagree — so a stale district from the previous state is a silent data
  // loss, and picking a new state has to clear it.
  //
  // The result is tagged with the state it belongs to rather than being cleared
  // up front, so "loading" and "stale" are both derived during render instead
  // of set by the effect.
  const stateId = Number(values?.state_id ?? 0);
  useEffect(() => {
    if (dialog === null || !stateId) return;
    let ignore = false;
    adminApi
      .districts(stateId)
      .then((rows) => {
        if (ignore) return;
        setDistrictState({ stateId, rows });
      })
      .catch(() => {
        if (ignore) return;
        setDistrictState({ stateId, rows: [] });
      });
    return () => {
      ignore = true;
    };
  }, [dialog, stateId]);

  const districtsLoading = stateId !== 0 && districtState?.stateId !== stateId;
  const districts = districtsLoading ? [] : (districtState?.rows ?? []);

  const all = useMemo<CollegeRow[]>(
    () =>
      (data ?? []).map((c) => {
        const { id, ...rest } = c;
        return { ...rest, id: String(id), record: c };
      }),
    [data],
  );

  const rows = sector === "all" ? all : all.filter((c) => c.ownership === sector);
  const government = all.filter((c) => c.ownership === "Government").length;

  const closeDialog = () => {
    setDialog(null);
    setValues(null);
    setFormError(null);
    setDistrictState(null);
  };

  const openCreate = () => {
    setValues({ ...EMPTY_COLLEGE_FORM });
    setFormError(null);
    setDialog({ mode: "create" });
  };

  const openEdit = async (record: ApiCollegeListItem) => {
    const ref = collegeRefFor(record);
    setDialog({ mode: "update", ref, label: record.name });
    setValues(null);
    setFormError(null);
    setBusyRow(ref);
    try {
      const detail = await adminApi.college(ref);
      setValues(collegeFormFromDetail(detail));
    } catch (err) {
      // Left with `values === null`, so the dialog keeps showing "Loading" and
      // its submit button stays disabled — better than offering a save that
      // would blank the record.
      showToast({
        title: "Could not load the college",
        description: describeCollegeError(err),
        variant: "error",
      });
      closeDialog();
    } finally {
      setBusyRow(null);
    }
  };

  const selectState = (next: string) => {
    setValues((v) => (v ? { ...v, state_id: next, district_id: "" } : v));
  };

  const submit = async () => {
    if (dialog === null || values === null) return;
    const built = buildCollegePayload(values, dialog.mode);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (dialog.mode === "create") {
        const created = await adminApi.createCollege(built.payload);
        showToast({ title: "College created", description: created.name, variant: "success" });
      } else {
        const updated = await adminApi.updateCollege(dialog.ref, built.payload);
        showToast({ title: "College updated", description: updated.name, variant: "success" });
      }
      closeDialog();
      reload();
    } catch (err) {
      setFormError(describeCollegeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeatured = async (record: ApiCollegeListItem) => {
    const ref = collegeRefFor(record);
    setBusyRow(ref);
    try {
      await adminApi.updateCollege(ref, { is_featured: !record.is_featured });
      showToast({
        title: record.is_featured ? "Removed from featured" : "Now featured",
        description: record.name,
        variant: "success",
      });
      reload();
    } catch (err) {
      showToast({
        title: "Could not update",
        description: describeCollegeError(err),
        variant: "error",
      });
    } finally {
      setBusyRow(null);
    }
  };

  const remove = async (record: ApiCollegeListItem) => {
    const ref = collegeRefFor(record);
    setPendingDelete(null);
    setBusyRow(ref);
    try {
      await adminApi.deleteCollege(ref);
      showToast({ title: "College deleted", description: record.name, variant: "success" });
      reload();
    } catch (err) {
      showToast({
        title: "Could not delete",
        description: describeCollegeError(err),
        variant: "error",
      });
    } finally {
      setBusyRow(null);
    }
  };

  const title =
    dialog === null ? "College" : dialog.mode === "create" ? "Add college" : `Edit ${dialog.label}`;

  return (
    <div>
      <SectionHeading
        title="Colleges"
        description="Institution records loaded from the catalogue API"
        count={rows.length}
        action={
          canWrite ? (
            <Button type="button" size="sm" variant="accent" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add college
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <FilterChips
          options={["Government", "Private"] as const}
          value={sector}
          onChange={setSector}
          counts={
            { Government: government, Private: all.length - government } as Partial<
              Record<"Government" | "Private" | "all", number>
            >
          }
        />
      </div>

      {error ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      ) : loading && all.length === 0 ? (
        <p className="px-1 py-6 text-sm text-slate-400">Loading colleges…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: "name",
              header: "College",
              render: (c) => <span className="font-semibold text-gray-900">{c.name}</span>,
            },
            { key: "college_id", header: "Code", render: (c) => <span className="text-slate-500">{c.college_id}</span> },
            { key: "city", header: "Location", render: (c) => (c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : "—") },
            {
              key: "ownership",
              header: "Type",
              render: (c) =>
                c.ownership ? (
                  <Badge variant={c.ownership === "Government" ? "blue" : "orange"}>{c.ownership}</Badge>
                ) : (
                  "—"
                ),
            },
            { key: "college_type", header: "Institution", render: (c) => c.college_type ?? "—" },
            { key: "university_name", header: "University", render: (c) => c.university_name ?? "—" },
            { key: "has_hostel", header: "Hostel", render: (c) => (c.has_hostel == null ? "—" : c.has_hostel ? "Yes" : "No") },
            {
              key: "average_rating",
              header: "Rating",
              render: (c) => (c.total_reviews > 0 ? `${c.average_rating} ★ (${c.total_reviews})` : "—"),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (c) => {
                const ref = collegeRefFor(c.record);
                const busy = busyRow === ref;
                if (pendingDelete === ref) {
                  return (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(c.record)}
                        className="inline-flex h-7 items-center rounded-lg bg-red-500 px-2.5 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                      >
                        Delete anyway
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="inline-flex h-7 items-center rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="flex items-center justify-end gap-1">
                    {c.is_featured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-label="Featured" />}
                    {canWrite && (
                      <>
                        <IconAction
                          title={c.is_featured ? "Remove from featured" : "Mark as featured"}
                          onClick={() => void toggleFeatured(c.record)}
                          disabled={busy}
                          className="hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Star className="h-4 w-4" />
                        </IconAction>
                        <IconAction title="Edit college" onClick={() => void openEdit(c.record)} disabled={busy}>
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                      </>
                    )}
                    {canDelete && (
                      <IconAction
                        title="Delete college"
                        onClick={() => setPendingDelete(ref)}
                        disabled={busy}
                        className="hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconAction>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={rows}
          searchKeys={["name", "college_id", "city", "university_name"]}
          searchPlaceholder="Search colleges..."
          emptyState="No colleges match this filter."
        />
      )}

      <Modal open={dialog !== null} onClose={closeDialog} title={title} className="sm:max-w-3xl">
        {values === null ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading college…</p>
        ) : (
          <div>
            {lookupsError && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Reference data could not be loaded ({lookupsError}). Only the name is
                required, but the state, district, university and course lists are
                unavailable.
              </p>
            )}

            <CollegeFormFields
              values={values}
              onChange={setValues}
              onSelectState={selectState}
              mode={dialog?.mode ?? "create"}
              states={lookups?.states ?? []}
              districts={districts}
              districtsLoading={districtsLoading}
              universities={lookups?.universities ?? []}
              courses={lookups?.courses ?? []}
              disabled={submitting}
            />

            {/* aria-live so a rejected save is announced, not just shown. */}
            <p aria-live="polite" className="min-h-5 text-sm text-red-600">
              {formError ?? ""}
            </p>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => void submit()}
                disabled={submitting}
              >
                {submitting
                  ? "Saving…"
                  : dialog?.mode === "create"
                    ? "Create college"
                    : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
