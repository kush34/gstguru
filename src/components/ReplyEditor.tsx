"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

export default function ReplyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "<p>Your AI-drafted reply will appear here…</p>",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none bg-white p-5 text-zinc-900 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Load newly generated drafts (also the autosaved one on mount).
  // Safe from edit-clobbering: typing echoes back identical HTML via
  // onChange, so the compare below skips and the cursor never jumps.
  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  if (!editor) return <div className="rounded-md border p-5 text-sm text-zinc-500">Loading editor…</div>;

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"}`;

  return (
    <div>
      <div className="no-print mb-2 flex flex-wrap gap-1">
        <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-900 hover:bg-zinc-200" onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button className="rounded bg-zinc-100 px-2 py-1 text-sm text-zinc-900 hover:bg-zinc-200" onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      <div id="print-area" className="h-[75vh] overflow-y-auto rounded-md border border-zinc-200 bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
