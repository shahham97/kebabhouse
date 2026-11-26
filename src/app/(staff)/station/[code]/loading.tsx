export default function StationKdsLoading() {
  return (
    <div className="min-h-screen bg-[#120E0D] p-4 sm:p-6 space-y-4 animate-pulse">
      <div className="h-16 rounded-2xl bg-char-soft" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-char-soft" />
        ))}
      </div>
    </div>
  );
}
