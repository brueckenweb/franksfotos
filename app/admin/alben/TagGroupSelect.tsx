"use client";

import { useState } from "react";
import { ChevronRight, Tag, Check } from "lucide-react";

export interface TagOption {
  id: number;
  name: string;
  slug: string;
  groupId: number | null;
  groupName: string | null;
  groupColor: string | null;
}

interface Props {
  tags: TagOption[];
  value: string; // ausgewählte Tag-ID als String
  onChange: (value: string) => void;
}

export default function TagGroupSelect({ tags, value, onChange }: Props) {
  // Alle Gruppen-Sektionen standardmäßig eingeklappt
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  // Tags nach Gruppen gruppieren
  const tagsByGroup = tags.reduce<Record<string, TagOption[]>>((acc, tag) => {
    const key = tag.groupName ?? "Ohne Gruppe";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tag);
    return acc;
  }, {});

  const selectedTag = tags.find((t) => String(t.id) === value);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Ausgewähltes Tag anzeigen */}
      {selectedTag ? (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-amber-300 text-sm font-medium truncate">{selectedTag.name}</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto text-gray-500 hover:text-gray-300 text-xs underline flex-shrink-0"
          >
            Abwählen
          </button>
        </div>
      ) : (
        <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700 text-gray-500 text-xs">
          – Tag auswählen –
        </div>
      )}

      {/* Gruppen-Accordion */}
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-800">
        {Object.entries(tagsByGroup).map(([groupName, groupTags]) => {
          const isOpen = openGroups.has(groupName);
          const hasSelected = groupTags.some((t) => String(t.id) === value);

          return (
            <div key={groupName}>
              {/* Gruppen-Header */}
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-800 ${
                  isOpen ? "bg-gray-800" : "bg-gray-900"
                }`}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform duration-150 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <span className="text-gray-200 text-sm font-medium flex-1 truncate">
                  {groupName}
                </span>
                <span className="text-gray-600 text-xs flex-shrink-0">
                  {groupTags.length}
                </span>
                {hasSelected && !isOpen && (
                  <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                )}
              </button>

              {/* Tags in dieser Gruppe */}
              {isOpen && (
                <div className="bg-gray-950">
                  {groupTags.map((tag) => {
                    const isSelected = String(tag.id) === value;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => onChange(String(tag.id))}
                        className={`w-full flex items-center gap-2 px-8 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-amber-500/10 text-amber-300"
                            : "text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        )}
                        {!isSelected && <span className="w-3.5" />}
                        <span className="truncate">{tag.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
