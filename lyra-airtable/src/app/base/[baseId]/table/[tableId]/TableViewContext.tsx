"use client";

import { createContext, useContext, useState } from "react";
import type { FilterCondition } from "./types";
import type { RouterInputs } from "@/trpc/react";

type TableDataQueryInput = RouterInputs["table"]["getData"];

// ✅ Add SortCondition type
export type SortCondition = {
  id: string;
  columnId: string;
  direction: "asc" | "desc";
};

type TableViewContextType = {
  searchBarOpen: boolean;
  setSearchBarOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSearchButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;

  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  filterButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setFilterButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;

  filters: FilterCondition[];
  setFilters: (filters: FilterCondition[]) => void;
  filterConjunction: "and" | "or";
  setFilterConjunction: (mode: "and" | "or") => void;
  // ✅ Add sort state
  sortPanelOpen: boolean;
  setSortPanelOpen: (open: boolean) => void;
  sortButtonRef: React.RefObject<HTMLButtonElement | null> | null;
  setSortButtonRef: React.Dispatch<
    React.SetStateAction<React.RefObject<HTMLButtonElement | null> | null>
  >;
  sorts: SortCondition[];
  setSorts: (sorts: SortCondition[]) => void;

  dataQueryKey: TableDataQueryInput | null;
  setDataQueryKey: (key: TableDataQueryInput) => void;
};

const TableViewContext = createContext<TableViewContextType | null>(null);

export function TableViewProvider({ children }: { children: React.ReactNode }) {
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchButtonRef, setSearchButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filterButtonRef, setFilterButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [filterConjunction, setFilterConjunction] = useState<"and" | "or">(
    "and",
  );

  // ✅ Add sort state
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [sortButtonRef, setSortButtonRef] =
    useState<React.RefObject<HTMLButtonElement | null> | null>(null);
  const [sorts, setSorts] = useState<SortCondition[]>([]);
  const [dataQueryKey, setDataQueryKey] = useState<TableDataQueryInput | null>(
    null,
  );

  return (
    <TableViewContext.Provider
      value={{
        searchBarOpen,
        setSearchBarOpen,
        searchQuery,
        setSearchQuery,
        searchButtonRef,
        setSearchButtonRef,
        filterPanelOpen,
        setFilterPanelOpen,
        filterButtonRef,
        setFilterButtonRef,
        filters,
        setFilters,
        filterConjunction,
        setFilterConjunction,
        sortPanelOpen,
        setSortPanelOpen,
        sortButtonRef,
        setSortButtonRef,
        sorts,
        setSorts,
        dataQueryKey,
        setDataQueryKey,
      }}
    >
      {children}
    </TableViewContext.Provider>
  );
}

export function useTableView() {
  const context = useContext(TableViewContext);
  if (!context) {
    throw new Error("useTableView must be used within TableViewProvider");
  }
  return context;
}
