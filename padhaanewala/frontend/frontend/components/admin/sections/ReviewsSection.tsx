"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Star, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { useApp } from "@/lib/context/AppContext";
import { adminApi, isForbidden } from "@/lib/api";
import { useAdminResource } from "@/components/admin/useAdminResource";
import { SectionHeading, RowActions, FilterChips } from "@/components/admin/primitives";

const STATUSES = ["Pending", "Approved", "Rejected"] as const;

interface ReviewRow {
  /** String id required by DataTable's generic constraint. */
  id: string;
  /** Server-side numeric id, or negative for local-only reviews. */
  apiId: number;
  author: string;
  body: string;
  rating: number;
  status: string;
  created: string;
}

/**
 * Review moderation against `GET /reviews/moderation` and
 * `POST /reviews/{id}/moderate` (admin / super_admin / reviewer).
 */
export function ReviewsSection() {
  const { reviews, showToast } = useApp();
  const [status, setStatus] = useState<string | "all">("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const { data, error, reload } = useAdminResource(() => adminApi.reviews("/moderation"), {
    forbiddenMessage: "You do not have permission to moderate reviews.",
    unreachableMessage: "Could not reach the reviews API.",
  });

  const remote = useMemo<ReviewRow[]>(
    () =>
      (data ?? []).map((r) => ({
        id: String(r.id),
        apiId: r.id,
        author: r.student_name ?? "Student",
        body: r.review_text ?? "—",
        rating: r.rating,
        status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
        created: new Date(r.created_at).toLocaleDateString("en-IN"),
      })),
    [data],
  );

  // Reviews written in this browser session, so the panel is not empty offline.
  const local = useMemo<ReviewRow[]>(
    () =>
      reviews.map((r, i) => ({
        id: `local-${i}`,
        apiId: -(i + 1),
        author: r.author,
        body: r.body,
        rating: r.rating,
        status: "Pending",
        created: r.date,
      })),
    [reviews],
  );

  const merged = useMemo(() => {
    if (!remote.length) return local;
    const seen = new Set(remote.map((r) => r.author + r.body));
    return [...remote, ...local.filter((r) => !seen.has(r.author + r.body))];
  }, [remote, local]);

  const counts = useMemo(() => {
    const by: Record<string, number> = {};
    for (const r of merged) by[r.status] = (by[r.status] ?? 0) + 1;
    return by;
  }, [merged]);

  const filtered = status === "all" ? merged : merged.filter((r) => r.status === status);

  const moderate = async (row: ReviewRow, decision: "approved" | "rejected") => {
    if (row.apiId < 0) {
      showToast({
        title: "Local review",
        description: "Only server-stored reviews can be moderated.",
        variant: "info",
      });
      return;
    }
    setBusyId(row.apiId);
    try {
      await adminApi.moderateReview(row.apiId, decision);
      reload();
      showToast({
        title: `Review ${decision}`,
        description: `Moderated review by ${row.author}.`,
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Could not moderate review",
        description: isForbidden(err) ? "You lack permission." : "Please retry.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Reviews"
        description="Moderate student reviews before publishing"
        count={merged.length}
      />

      {error && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </p>
      )}

      {merged.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          No reviews awaiting moderation.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <FilterChips
              options={STATUSES}
              value={status}
              onChange={setStatus}
              counts={counts as Partial<Record<string, number>>}
            />
          </div>
          <DataTable
            columns={[
              {
                key: "author",
                header: "Author",
                render: (r) => <span className="font-semibold text-gray-900">{r.author}</span>,
              },
              { key: "body", header: "Review" },
              {
                key: "rating",
                header: "Rating",
                render: (r) => (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{r.rating}</span>
                  </div>
                ),
              },
              { key: "created", header: "Date" },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge
                    variant={
                      r.status === "Approved" ? "green" : r.status === "Rejected" ? "red" : "yellow"
                    }
                  >
                    {r.status}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "text-right",
                render: (r) =>
                  r.status === "Pending" ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        disabled={busyId === r.apiId}
                        onClick={() => moderate(r, "approved")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="danger"
                        disabled={busyId === r.apiId}
                        onClick={() => moderate(r, "rejected")}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <RowActions item={r.author} noun="review" />
                  ),
              },
            ]}
            rows={filtered}
            searchKeys={["author", "body"]}
            searchPlaceholder="Search reviews..."
          />
        </>
      )}
    </div>
  );
}
