"use client";

import { useState, useEffect, useRef } from "react";

interface HomeSearchBarProps {
  onSearch?: (q: string) => void;
}

function HomeSearchBar({ onSearch }: HomeSearchBarProps) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /** CMD+K → focus search bar */
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setActive(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  /** Emit search text */
  useEffect(() => {
    if (onSearch) onSearch(query);
  }, [query, onSearch]); // ← FIXED dependency warning

  return (
    <div
      className="flex h-[32px] w-[360px] cursor-text items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 text-sm text-zinc-600"
      onClick={() => {
        setActive(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }}
    >
      {/* Search Icon */}
      <svg
        className="h-4 w-4 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 103.6 3.6a7.5 7.5 0 0013.05 13.05z"
        />
      </svg>

      {/* Input (active mode) */}
      {active ? (
        <input
          ref={inputRef}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(e.target.value) // ← FIXED: typed event
          }
          onBlur={() => {
            if (query === "") setActive(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setQuery("");
              setActive(false);
              inputRef.current?.blur();
            }
          }}
          className="flex-1 bg-transparent text-[13px] outline-none"
          placeholder="Search…"
          autoFocus
        />
      ) : (
        // Placeholder mode
        <span className="flex-1 text-[13px] text-zinc-500">Search…</span>
      )}

      {/* CMD+K hint (only when inactive) */}
      {!active && <span className="text-[11px] text-zinc-400">⌘ K</span>}
    </div>
  );
}

export default HomeSearchBar;