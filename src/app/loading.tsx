export default function GlobalLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-mono text-sm tracking-wide animate-pulse">Loading SocialOS...</p>
      </div>
    </div>
  );
}
