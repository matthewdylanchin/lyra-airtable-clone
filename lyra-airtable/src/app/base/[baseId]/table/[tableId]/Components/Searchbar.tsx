"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";

type SearchBarProps = {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalResults?: number;
  currentResultIndex?: number;
  onNextResult?: () => void;
  onPreviousResult?: () => void;
  searchButtonRef?: React.RefObject<HTMLButtonElement | null> | null;
};

export default function SearchBar({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  totalResults = 0,
  currentResultIndex = 0,
  onNextResult,
  onPreviousResult,
  searchButtonRef,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position based on search button
  useEffect(() => {
    if (!isOpen || !searchButtonRef?.current) return;

    const updatePosition = () => {
      const buttonRect = searchButtonRef.current?.getBoundingClientRect();
      if (buttonRect) {
        setPosition({
          top: buttonRect.bottom + 8,
          right: window.innerWidth - buttonRect.right,
        });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, searchButtonRef]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && mounted) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, mounted]);

  // Handle clicks outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchButtonRef?.current &&
        !searchButtonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, searchButtonRef]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }

      // Enter to go to next result
      if (e.key === "Enter" && !e.shiftKey && onNextResult) {
        e.preventDefault();
        onNextResult();
      }

      // Shift+Enter to go to previous result
      if (e.key === "Enter" && e.shiftKey && onPreviousResult) {
        e.preventDefault();
        onPreviousResult();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onNextResult, onPreviousResult]);

  if (!isOpen || !mounted) return null;

  const dropdown = (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] w-[320px] rounded-lg border border-zinc-200 bg-white shadow-xl"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2">
        {/* Search Icon */}
        <Search size={16} className="text-zinc-400" />

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find in table"
          className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
        />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="rounded p-0.5 hover:bg-zinc-100"
          aria-label="Close search"
        >
          <X size={16} className="text-zinc-500" />
        </button>
      </div>

      {/* Results Info */}
      {searchQuery && (
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <span className="text-xs text-zinc-600">
            {totalResults > 0
              ? `${currentResultIndex + 1} of ${totalResults} ${
                  totalResults === 1 ? "record" : "records"
                }`
              : "No records found"}
          </span>

          {/* Navigation Buttons */}
          {totalResults > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={onPreviousResult}
                disabled={currentResultIndex === 0}
                className="rounded p-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous result"
                title="Previous (Shift+Enter)"
              >
                <ChevronUp size={14} className="text-zinc-600" />
              </button>
              <button
                onClick={onNextResult}
                disabled={currentResultIndex >= totalResults - 1}
                className="rounded p-1 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next result"
                title="Next (Enter)"
              >
                <ChevronDown size={14} className="text-zinc-600" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state or instructions */}
      {!searchQuery && (
        <div className="px-3 py-6 text-center text-xs text-zinc-500">
          Type to search across all fields
        </div>
      )}
    </div>
  );

  return createPortal(dropdown, document.body);
}
