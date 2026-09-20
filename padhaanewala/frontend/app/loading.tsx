import { SkeletonGrid } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 h-10 w-72 animate-pulse rounded-xl bg-purple-100" />
      <SkeletonGrid count={6} />
    </div>
  );
}