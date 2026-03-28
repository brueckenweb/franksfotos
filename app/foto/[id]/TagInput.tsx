"use client";

import { useState, useEffect } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import CreateTagModal, { type CreatedTag } from "./CreateTagModal";

interface Tag {
  id: number;
  name: string;
  slug: string;
  groupName?: string;
  groupSlug?: string;
  groupColor?: string;
}

interface TagInputProps {
  photoId: number;
  initialTags: Tag[];
  /** Darf Tags hinzufügen/entfernen UND das Modal zum Erstellen neuer Tags öffnen */
  isLoggedIn: boolean;
  /** Darf Tags vom Foto entfernen (Admin-Recht) */
  isAdmin: boolean;
}

export default function TagInput({
  photoId,
  initialTags,
  isLoggedIn,
  isAdmin,
}: TagInputProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Lade verfügbare Tags wenn das Suchfeld geöffnet wird
  useEffect(() => {
    if (isLoggedIn && showInput) {
      fetchAvailableTags();
    }
  }, [isLoggedIn, showInput]);

  const fetchAvailableTags = async () => {
    try {
      const response = await fetch("/api/tags");
      if (response.ok) {
        const data = await response.json();
        const assignedTagIds = new Set(tags.map((t) => t.id));
        setAvailableTags(
          data.filter((tag: Tag) => !assignedTagIds.has(tag.id))
        );
      }
    } catch (error) {
      console.error("Fehler beim Laden der Tags:", error);
    }
  };

  // Tag zum Foto hinzufügen
  const addTag = async (tagId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (response.ok) {
        const newTag = availableTags.find((t) => t.id === tagId);
        if (newTag) {
          setTags((prev) => [...prev, newTag]);
          setAvailableTags((prev) => prev.filter((t) => t.id !== tagId));
        }
      }
    } catch (error) {
      console.error("Fehler beim Hinzufügen des Tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Tag vom Foto entfernen
  const removeTag = async (tagId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/tags/${tagId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        const removedTag = tags.find((t) => t.id === tagId);
        if (removedTag) {
          setTags((prev) => prev.filter((t) => t.id !== tagId));
          setAvailableTags((prev) => [...prev, removedTag]);
        }
      }
    } catch (error) {
      console.error("Fehler beim Entfernen des Tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Nach Modal: Neuen Tag erstellen und direkt dem Foto zuweisen
  const handleTagCreated = async (created: CreatedTag) => {
    setShowModal(false);
    setIsLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: created.id }),
      });
      if (response.ok) {
        const newTag: Tag = {
          id: created.id,
          name: created.name,
          slug: created.slug,
          groupName: created.groupName ?? undefined,
          groupColor: created.groupColor ?? undefined,
        };
        setTags((prev) => [...prev, newTag]);
        // Aus verfügbaren Tags entfernen (falls geladen)
        setAvailableTags((prev) => prev.filter((t) => t.id !== created.id));
      }
    } catch (error) {
      console.error("Fehler beim Zuweisen des neuen Tags:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(inputValue.toLowerCase()) ||
      (tag.groupName &&
        tag.groupName.toLowerCase().includes(inputValue.toLowerCase()))
  );

  // Nichts anzeigen wenn: keine Tags vorhanden UND nicht eingeloggt
  if (tags.length === 0 && !isLoggedIn) {
    return null;
  }

  return (
    <>
      <div>
        {/* Kopfzeile */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">Tags</h3>
          {isLoggedIn && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInput(!showInput)}
                className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Hinzufügen
              </button>
            </div>
          )}
        </div>

        {/* Suchfeld für vorhandene Tags */}
        {isLoggedIn && showInput && (
          <div className="mb-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tag suchen..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />

            {/* Trefferliste */}
            {filteredTags.length > 0 && (
              <div className="mt-1 max-h-36 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg">
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag.id)}
                    disabled={isLoading}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-between disabled:opacity-50"
                  >
                    <span>
                      {tag.groupName && (
                        <span
                          style={{ color: tag.groupColor }}
                          className="mr-1.5 text-xs"
                        >
                          {tag.groupName}:
                        </span>
                      )}
                      {tag.name}
                    </span>
                    <Plus className="w-3 h-3 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* "Neuen Tag erstellen"-Button */}
            <button
              onClick={() => {
                setShowInput(false);
                setShowModal(true);
              }}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-gray-800/50 hover:bg-gray-800 border border-dashed border-gray-700 hover:border-amber-600 rounded-lg px-3 py-2 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Neuen Tag erstellen…
            </button>
          </div>
        )}

        {/* Tag-Badges */}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: tag.groupColor || "#6b7280",
                  color: "white",
                }}
              >
                {tag.groupName && (
                  <span className="opacity-75">{tag.groupName}:</span>
                )}
                {tag.name}
                {isAdmin && (
                  <button
                    onClick={() => removeTag(tag.id)}
                    disabled={isLoading}
                    className="ml-0.5 opacity-75 hover:opacity-100 disabled:opacity-50 transition-opacity"
                    title={`Tag "${tag.name}" entfernen`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}

            {/* Kompakter Modal-Button neben den Badges (eingeloggt + kein Suchfeld offen) */}
            {isLoggedIn && !showInput && (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:text-amber-400 border border-dashed border-gray-700 hover:border-amber-600 transition-colors"
                title="Neuen Tag erstellen"
              >
                <Sparkles className="w-3 h-3" />
                Neu
              </button>
            )}
          </div>
        ) : (
          isLoggedIn && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-600">Noch keine Tags zugewiesen.</p>
              {!showInput && (
                <button
                  onClick={() => setShowModal(true)}
                  className="self-start flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-dashed border-amber-800 hover:border-amber-600 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ersten Tag erstellen…
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <CreateTagModal
          onClose={() => setShowModal(false)}
          onTagCreated={handleTagCreated}
        />
      )}
    </>
  );
}
