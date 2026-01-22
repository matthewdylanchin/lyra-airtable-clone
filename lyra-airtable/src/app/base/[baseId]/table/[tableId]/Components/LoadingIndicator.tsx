export function TableLoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;

  return (
    <div className="flex items-center gap-2 rounded-full px-3 py-1 text-xs text-zinc-600">
      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
        />
      </svg>
      Saving…
    </div>
  );
}
