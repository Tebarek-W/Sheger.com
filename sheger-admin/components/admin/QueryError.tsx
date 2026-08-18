export function QueryError({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">{title}</h1>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {message ?? "This data could not be loaded. Refresh the page or try again shortly."}
      </p>
    </div>
  );
}
