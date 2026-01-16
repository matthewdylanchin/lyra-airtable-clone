"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/trpc/react";
import {
  Type,
  Hash,
  Calendar,
  Phone,
  Mail,
  Link,
  DollarSign,
  Percent,
  Clock,
  TextInitial,
  ChevronDown,
  User,
} from "lucide-react";

type EditFieldPopoverProps = {
  column: {
    id: string;
    name: string;
    type: string;
  };
  tableId: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
};

const fieldTypes = [
  { value: "TEXT", label: "Single line text", icon: <Type size={16} /> },
  { value: "LONG_TEXT", label: "Long text", icon: <TextInitial size={16} /> },
  {
    value: "DATE",
    label: "Date",
    icon: <Calendar size={16} />,
    disabled: true,
  },
  {
    value: "PHONE",
    label: "Phone number",
    icon: <Phone size={16} />,
    disabled: true,
  },
  { value: "EMAIL", label: "Email", icon: <Mail size={16} />, disabled: true },
  { value: "URL", label: "URL", icon: <Link size={16} />, disabled: true },
  { value: "NUMBER", label: "Number", icon: <Hash size={16} /> },
  {
    value: "CURRENCY",
    label: "Currency",
    icon: <DollarSign size={16} />,
    disabled: true,
  },
  {
    value: "PERCENT",
    label: "Percent",
    icon: <Percent size={16} />,
    disabled: true,
  },
  {
    value: "DURATION",
    label: "Duration",
    icon: <Clock size={16} />,
    disabled: true,
  },
];

export default function EditFieldPopover({
  column,
  tableId,
  anchorRef,
  onClose,
}: EditFieldPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const [name, setName] = useState(column.name);
  const [type, setType] = useState(column.type);

  const utils = api.useUtils();
  const renameColumn = api.column.rename.useMutation({
    onSuccess: () => {
      utils.table.getData.invalidate({ tableId });
      onClose();
    },
  });

  /* ---------------- Position aligned with column start (accounting for chevron) ---------------- */
  useLayoutEffect(() => {
    if (!anchorRef.current || !popoverRef.current) return;

    const rect = anchorRef.current.getBoundingClientRect();
    const GAP = 8;

    // The anchor is the column header which includes the chevron
    // We need to account for the padding and chevron width
    // Typically the text starts about 8-12px from the left edge
    const OFFSET = 12; // Adjust this to align with column text start

    setCoords({
      top: rect.bottom + GAP,
      left: rect.left + OFFSET,
    });
  }, [anchorRef]);

  /* ---------------- Auto-focus name input ---------------- */
  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }, []);

  /* ---------------- Close on outside click ---------------- */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, anchorRef]);

  const selectedType = fieldTypes.find((ft) => ft.value === type);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[10000] w-[600px] rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="p-6">
        {/* Icon and Name input */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white">
            <User size={20} className="text-zinc-600" />
          </div>
          <input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-[15px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Type selector dropdown */}
        <div className="relative mb-4">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-300 px-4 py-2.5 text-left text-[15px] outline-none hover:bg-zinc-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <div className="flex items-center gap-3">
              <span className="text-zinc-600">{selectedType?.icon}</span>
              <span className="text-zinc-900">{selectedType?.label}</span>
            </div>
            <ChevronDown size={18} className="text-zinc-400" />
          </button>

          {/* Type dropdown */}
          {showTypeDropdown && (
            <div
              ref={typeDropdownRef}
              className="absolute top-full z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
            >
              {fieldTypes.map((ft) => (
                <button
                  key={ft.value}
                  disabled={ft.disabled}
                  onClick={() => {
                    if (!ft.disabled) {
                      setType(ft.value);
                      setShowTypeDropdown(false);
                    }
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                    ft.value === type ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="text-zinc-600">{ft.icon}</span>
                  <span className="text-zinc-900">{ft.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description text */}
        <div className="mb-4 text-sm text-zinc-500">Enter text.</div>

        {/* Add description button */}
        <button className="flex items-center gap-2 text-[15px] text-zinc-600 hover:text-zinc-900">
          <span className="text-xl font-light">+</span>
          <span>Add description</span>
        </button>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-[15px] font-medium text-zinc-700 hover:bg-zinc-100"
        >
          Cancel
        </button>

        <button
          onClick={() =>
            renameColumn.mutate({
              id: column.id,
              name,
            })
          }
          disabled={!name.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-[15px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>,
    document.body,
  );
}
