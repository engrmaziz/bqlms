"use client";

import ImageExtension from "@tiptap/extension-image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import { useEffect, useState } from "react";

const MAX_BODY_BYTES = 200 * 1024; // 200 KB limit

export interface RichEditorProps {
  initialContent?: Record<string, unknown> | null;
  onChange: (content: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function RichEditor({
  initialContent,
  onChange,
  disabled = false,
}: RichEditorProps) {
  const [contentSize, setContentSize] = useState<number>(0);
  const [isOverLimit, setIsOverLimit] = useState<boolean>(false);

  const safeContent =
    initialContent &&
    initialContent.type === "doc" &&
    Array.isArray(initialContent.content)
      ? initialContent
      : {
          type: "doc",
          content: [{ type: "paragraph" }],
        };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ImageExtension.configure({
        inline: true,
        allowBase64: false, // Invariant 10: No base64 images in DB!
      }),
    ],
    content: safeContent,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Record<string, unknown>;
      const bytes = new TextEncoder().encode(JSON.stringify(json)).length;
      setContentSize(bytes);
      setIsOverLimit(bytes > MAX_BODY_BYTES);
      onChange(json);
    },
  });

  useEffect(() => {
    if (editor && initialContent && initialContent.type === "doc") {
      const currentJson = editor.getJSON();
      if (JSON.stringify(currentJson) !== JSON.stringify(initialContent)) {
        editor.commands.setContent(initialContent);
        const bytes = new TextEncoder().encode(
          JSON.stringify(initialContent),
        ).length;
        setContentSize(bytes);
        setIsOverLimit(bytes > MAX_BODY_BYTES);
      }
    }
  }, [editor, initialContent]);

  if (!editor) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
        Loading editor...
      </div>
    );
  }

  const addImage = () => {
    const url = window.prompt(
      "Enter image URL (e.g. from uploaded files /api/v1/media/[fileId]/[key]):",
    );
    if (
      url &&
      (url.startsWith("/api/v1/media/") || url.startsWith("https://"))
    ) {
      editor.chain().focus().setImage({ src: url }).run();
    } else if (url) {
      alert("Invalid image URL. Must be an uploaded media URL or https URL.");
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("bold")
              ? "bg-slate-200 font-bold dark:bg-slate-800"
              : ""
          }`}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("italic")
              ? "bg-slate-200 italic dark:bg-slate-800"
              : ""
          }`}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("strike") ? "bg-slate-200 dark:bg-slate-800" : ""
          }`}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" />

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("heading", { level: 1 })
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("heading", { level: 2 })
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("heading", { level: 3 })
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("bulletList")
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("orderedList")
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("blockquote")
              ? "bg-slate-200 dark:bg-slate-800"
              : ""
          }`}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 ${
            editor.isActive("codeBlock") ? "bg-slate-200 dark:bg-slate-800" : ""
          }`}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={addImage}
          className="rounded p-1.5 text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Insert Image"
        >
          <ImageIcon className="h-4 w-4" />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="min-h-[280px] p-4 font-sans text-slate-900 focus-within:outline-none dark:text-slate-100">
        <EditorContent editor={editor} />
      </div>

      {/* Size / Status bar */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span
          className={
            isOverLimit ? "font-bold text-rose-600 dark:text-rose-400" : ""
          }
        >
          Size: {(contentSize / 1024).toFixed(1)} KB / 200 KB max
          {isOverLimit && " (EXCEEDS LIMIT!)"}
        </span>
        <span>ProseMirror Document</span>
      </div>
    </div>
  );
}
