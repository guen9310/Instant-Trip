export function CourseResultSkeleton() {
  return (
    <div className="flex-1 px-4 pt-5 pb-4 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted mb-2" />
      <div className="h-4 w-32 rounded bg-muted mb-5" />
      <div className="h-20 rounded-xl bg-muted" />
      <div className="mt-6 h-16 rounded-xl bg-muted" />
    </div>
  );
}
