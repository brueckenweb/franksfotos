"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Link2,
  Link2Off,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
} from "lucide-react";

interface EmailEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-amber-500 text-white"
          : "text-gray-400 hover:text-white hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function EmailEditor({ value, onChange }: EmailEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-amber-400 underline" },
      }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[280px] p-4 focus:outline-none text-gray-200 leading-relaxed",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Wert von außen aktualisieren (z. B. bei Reset)
  useEffect(() => {
    if (editor && value === "") {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string;
    const url = window.prompt("URL eingeben:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-700 bg-gray-900">
        {/* Text-Format */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Fett (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Kursiv (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Unterstrichen (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Überschriften */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Überschrift H2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Überschrift H3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Listen */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Aufzählung"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Nummerierte Liste"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Trennlinie"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Ausrichtung */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Linksbündig"
        >
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Zentriert"
        >
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Rechtsbündig"
        >
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Link */}
        <ToolbarButton
          onClick={setLink}
          active={editor.isActive("link")}
          title="Link einfügen"
        >
          <Link2 className="w-4 h-4" />
        </ToolbarButton>
        {editor.isActive("link") && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Link entfernen"
          >
            <Link2Off className="w-4 h-4" />
          </ToolbarButton>
        )}

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Farbe */}
        <div className="flex items-center gap-1" title="Textfarbe">
          <span className="text-xs text-gray-500">A</span>
          <input
            type="color"
            value={editor.getAttributes("textStyle").color || "#ffffff"}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            title="Textfarbe wählen"
          />
        </div>

        <div className="flex-1" />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Rückgängig (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Wiederholen (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor-Inhalt */}
      <EditorContent editor={editor} />

      {/* Styles für den Editor-Inhalt */}
      <style>{`
        .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #f59e0b; }
        .ProseMirror h3 { font-size: 1.15rem; font-weight: 600; margin: 0.8rem 0 0.4rem; color: #fbbf24; }
        .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .ProseMirror li { margin: 0.2rem 0; }
        .ProseMirror hr { border-color: #4b5563; margin: 1rem 0; }
        .ProseMirror a { color: #f59e0b; text-decoration: underline; }
        .ProseMirror p { margin: 0.5rem 0; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #6b7280;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
