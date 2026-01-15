"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function CreateModal({ open, onClose }: any) {
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
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <div
              className="w-[640px] rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xl font-semibold">
                  How do you want to start?
                </div>
                <button
                  onClick={onClose}
                  className="text-zinc-500 hover:text-zinc-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 text-sm text-zinc-600">
                <span className="font-medium">Workspace:</span> Workspace ▼
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Omni option */}
                <div className="cursor-pointer rounded-xl border p-4 transition hover:shadow-md">
                  <div className="mb-1 text-[15px] font-medium">
                    Build an app with Omni
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-[2px] text-[10px] text-green-700">
                      New
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500">
                    Use AI to build a custom app tailored to your workflow.
                  </div>
                </div>

                {/* Blank option */}
                <div className="cursor-pointer rounded-xl border p-4 transition hover:shadow-md">
                  <div className="mb-1 text-[15px] font-medium">
                    Build an app on your own
                  </div>
                  <div className="text-sm text-zinc-500">
                    Start with a blank app and build your ideal workflow.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
