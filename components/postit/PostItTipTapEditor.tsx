"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { useState, useEffect, useRef } from "react";
import {
  Bold, Italic, Underline as UIcon,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link2, Code2,
  Heading2, Heading3,
} from "lucide-react";

// ── Farben & Highlight-Farben (wie brueckenweb) ───────────────────────────────
const TEXT_COLORS = [
  "#000000","#1f2937","#374151","#ef4444","#f97316",
  "#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899",
  "#0891b2","#059669","#dc2626",
];

const HIGHLIGHT_COLORS = [
  { color: "#fef08a", label: "Gelb" },
  { color: "#bbf7d0", label: "Grün" },
  { color: "#bfdbfe", label: "Blau" },
  { color: "#fecaca", label: "Rot" },
  { color: "#fed7aa", label: "Orange" },
  { color: "#e9d5ff", label: "Lila" },
  { color: "#fbcfe8", label: "Pink" },
  { color: "#d1fae5", label: "Mint" },
];

interface Props {
  content: string;
  onChange: (html: string) => void;
}

// ── Toolbar-Button ────────────────────────────────────────────────────────────
function TBtn({
  onClick, active, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`postit-tbtn ${active ? "postit-tbtn-active" : ""}`}
    >
      {children}
    </button>
  );
}

// ── Trennlinie ────────────────────────────────────────────────────────────────
function Sep() {
  return <span className="postit-editor-sep" />;
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function PostItTipTapEditor({ content, onChange }: Props) {
  const [showLinkPopup, setShowLinkPopup]         = useState(false);
  const [linkUrl, setLinkUrl]                     = useState("");
  const [showCodeView, setShowCodeView]           = useState(false);
  const [codeContent, setCodeContent]             = useState("");
  const [showColorDrop, setShowColorDrop]         = useState(false);
  const [showHighlightDrop, setShowHighlightDrop] = useState(false);

  const colorRef     = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Dropdowns bei Außen-Klick schließen
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorDrop(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setShowHighlightDrop(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: content || "<p></p>",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Inhalt synchronisieren wenn von außen geändert
  useEffect(() => {
    if (!editor) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || "<p></p>");
    }
  }, [content, editor]);

  if (!editor) return null;

  // ── Link-Handler ─────────────────────────────────────────────────────────
  function openLinkPopup() {
    const existing = editor!.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setShowLinkPopup(true);
  }

  function saveLink() {
    if (linkUrl.trim()) {
      editor!.chain().focus().setLink({ href: linkUrl.trim() }).run();
    } else {
      editor!.chain().focus().unsetLink().run();
    }
    setShowLinkPopup(false);
  }

  // ── Code-View-Toggle ──────────────────────────────────────────────────────
  function toggleCodeView() {
    if (!showCodeView) {
      setCodeContent(editor!.getHTML());
      setShowCodeView(true);
    } else {
      editor!.commands.setContent(codeContent);
      onChange(codeContent);
      setShowCodeView(false);
    }
  }

  return (
    <div className="postit-editor-wrapper">

      {/* ── Toolbar ── */}
      <div className="postit-editor-toolbar">

        {/* Formatierung */}
        <TBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")} title="Fett (Strg+B)">
          <Bold className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")} title="Kursiv (Strg+I)">
          <Italic className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")} title="Unterstrichen (Strg+U)">
          <UIcon className="w-4 h-4" />
        </TBtn>

        <Sep />

        {/* Überschriften */}
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })} title="Überschrift 2">
          <Heading2 className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })} title="Überschrift 3">
          <Heading3 className="w-4 h-4" />
        </TBtn>

        <Sep />

        {/* Ausrichtung */}
        <TBtn onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })} title="Linksbündig">
          <AlignLeft className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })} title="Zentriert">
          <AlignCenter className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })} title="Rechtsbündig">
          <AlignRight className="w-4 h-4" />
        </TBtn>

        <Sep />

        {/* Listen */}
        <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")} title="Aufzählungsliste">
          <List className="w-4 h-4" />
        </TBtn>
        <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")} title="Nummerierte Liste">
          <ListOrdered className="w-4 h-4" />
        </TBtn>

        <Sep />

        {/* Link */}
        <TBtn onClick={openLinkPopup}
          active={editor.isActive("link")} title="Link einfügen/bearbeiten">
          <Link2 className="w-4 h-4" />
        </TBtn>

        <Sep />

        {/* Textfarbe – React-State-Dropdown */}
        <div ref={colorRef} className="postit-dropdown">
          <button
            type="button"
            className="postit-tbtn"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorDrop((v) => !v);
              setShowHighlightDrop(false);
            }}
            title="Textfarbe"
          >
            {/* A mit Farbbalken */}
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2L13 13H3L8 2Z" />
              <line x1="4" y1="13" x2="12" y2="13" stroke="#ef4444" strokeWidth="3" />
            </svg>
          </button>
          <div className={`postit-dropdown-panel postit-color-grid${showColorDrop ? " postit-dropdown-panel-open" : ""}`}>
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="postit-color-swatch"
                style={{ background: c }}
                title={c}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColorDrop(false);
                }}
              />
            ))}
            <button
              type="button"
              className="postit-color-swatch postit-color-remove"
              title="Farbe entfernen"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowColorDrop(false);
              }}
            >✕</button>
          </div>
        </div>

        {/* Textmarker – React-State-Dropdown */}
        <div ref={highlightRef} className="postit-dropdown">
          <button
            type="button"
            className={`postit-tbtn ${editor.isActive("highlight") ? "postit-tbtn-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowHighlightDrop((v) => !v);
              setShowColorDrop(false);
            }}
            title="Textmarker"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2l3 3-7 7-4 1 1-4 7-7z" />
              <line x1="3" y1="14" x2="13" y2="14" strokeWidth="2" />
            </svg>
          </button>
          <div className={`postit-dropdown-panel postit-highlight-grid${showHighlightDrop ? " postit-dropdown-panel-open" : ""}`}>
            {HIGHLIGHT_COLORS.map(({ color, label }) => (
              <button
                key={color}
                type="button"
                className="postit-color-swatch"
                style={{ background: color }}
                title={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color }).run();
                  setShowHighlightDrop(false);
                }}
              />
            ))}
            <button
              type="button"
              className="postit-color-swatch postit-color-remove"
              title="Markierung entfernen"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setShowHighlightDrop(false);
              }}
            >✕</button>
          </div>
        </div>

        <Sep />

        {/* HTML-Code-Ansicht */}
        <TBtn onClick={toggleCodeView} active={showCodeView} title={showCodeView ? "Visuelle Ansicht" : "HTML-Code"}>
          <Code2 className="w-4 h-4" />
        </TBtn>
      </div>

      {/* ── Editor-Bereich ── */}
      {showCodeView ? (
        <textarea
          value={codeContent}
          onChange={(e) => setCodeContent(e.target.value)}
          className="postit-editor-code"
        />
      ) : (
        <EditorContent editor={editor} />
      )}

      {/* ── Link-Popup ── */}
      {showLinkPopup && (
        <>
          <div
            className="postit-popup-overlay"
            onClick={() => setShowLinkPopup(false)}
          />
          <div className="postit-link-popup">
            <p className="text-sm text-gray-300 mb-2 font-medium">Link einfügen</p>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveLink()}
              placeholder="https://…  (leer lassen zum Entfernen)"
              className="input-field mb-3"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowLinkPopup(false)}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveLink}
                className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                {linkUrl.trim() ? "Speichern" : "Entfernen"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
