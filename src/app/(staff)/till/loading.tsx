export default function TillLoading() {
  return (
    <div className="min-h-screen bg-cream p-4 sm:p-6 space-y-4 animate-pulse">
      <div className="h-14 rounded-2xl bg-char/15" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-[70vh] rounded-2xl bg-cream-deep" />
        <div className="h-[70vh] rounded-2xl bg-cream-deep" />
      </div>
    </div>
  );
}
