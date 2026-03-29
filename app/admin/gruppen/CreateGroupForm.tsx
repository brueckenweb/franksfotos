"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Loader2, X, ChevronDown } from "lucide-react";
import { createGroup } from "./actions";

export default function CreateGroupForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createGroup(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  }

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neue Gruppe erstellen
        </button>
      ) : (
        <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Neue Gruppe
            </h2>
            <button
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="z. B. Familie"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Sortierung */}
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">
                  Sortierung
                </label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={0}
                  min={0}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* Beschreibung */}
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1">
                Beschreibung <span className="text-gray-600">(optional)</span>
              </label>
              <input
                name="description"
                type="text"
                placeholder="Kurze Beschreibung der Gruppe"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <p className="text-xs text-gray-600">
              <ChevronDown className="w-3 h-3 inline mr-1" />
              Der Slug wird automatisch aus dem Namen generiert.
            </p>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                {isPending ? "Wird erstellt…" : "Gruppe erstellen"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                }}
                className="text-gray-400 hover:text-gray-200 text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
