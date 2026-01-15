"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

export default function CreateModal({ open, onClose }: any) {
  const router = useRouter();

  const createBase = api.base.create.useMutation({
    onSuccess(data) {
      // Redirect to new base table view
      router.push(`/base/${data.baseId}/table/${data.tableId}`);
      onClose();
    },
  });

  function handleCreateBlank() {
    createBase.mutate({ name: "Untitled Base" });
  }

  // ESC to close
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <div
              className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-6 flex items-start justify-between">
                <h2 className="text-2xl font-semibold text-zinc-900">
                  How do you want to start?
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>

              {/* Workspace selector */}
              <div className="mb-6 text-sm text-zinc-700">
                <span className="font-semibold">Workspace:</span>{" "}
                <span className="text-zinc-600">Workspace</span>{" "}
                <span className="text-zinc-400">▾</span>
              </div>

              {/* Options grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Omni option (disabled for now) */}
                <button className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-zinc-300 hover:shadow-lg">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-pink-50 to-purple-50">
                    <Image
                      src="/omni-preview.png"
                      alt="Build with Omni"
                      fill
                      className="object-contain p-6"
                    />
                  </div>

                  <div className="p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-base font-semibold text-zinc-900">
                        Build an app with Omni
                      </span>
                      <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        New
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600">
                      Use AI to build a custom app tailored to your workflow.
                    </p>
                  </div>
                </button>

                {/* Blank option */}
                <button
                  onClick={handleCreateBlank}
                  disabled={createBase.isPending}
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition hover:border-zinc-300 hover:shadow-lg disabled:opacity-50"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
                    <Image
                      src="/blank-preview.png"
                      alt="Build on your own"
                      fill
                      className="object-contain p-6"
                    />
                  </div>

                  <div className="p-4">
                    <span className="mb-1 block text-base font-semibold text-zinc-900">
                      Build an app on your own
                    </span>
                    <p className="text-sm text-zinc-600">
                      {createBase.isPending
                        ? "Creating…"
                        : "Start with a blank app and build your ideal workflow."}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
