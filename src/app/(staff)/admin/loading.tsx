export default function AdminLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-9 w-56 rounded-xl bg-cream-deep" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-cream-deep" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-cream-deep" />
    </div>
  );
}
