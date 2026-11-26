export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 space-y-8 animate-pulse">
      <div className="h-64 sm:h-80 rounded-3xl bg-cream-deep" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 rounded-2xl bg-cream-deep" />
        ))}
      </div>
    </div>
  );
}
