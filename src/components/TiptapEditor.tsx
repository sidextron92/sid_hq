"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Toolbar ───────────────────────────────────────
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
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className="tiptap-toolbar-btn"
      style={{
        padding: "4px 7px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
        cursor: "pointer",
        border: "1px solid transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.6)",
        background: active ? "rgba(255,255,255,0.15)" : "transparent",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, inTable }: { editor: ReturnType<typeof useEditor> | null; inTable: boolean }) {

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 px-2 py-1.5"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Strikethrough"
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline Code"
      >
        {"<>"}
      </ToolbarButton>

      <div
        style={{
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.15)",
          margin: "0 4px",
        }}
      />

      {/* Headings */}
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>

      <div
        style={{
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.15)",
          margin: "0 4px",
        }}
      />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Bullet List"
      >
        &bull;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Numbered List"
      >
        1.
      </ToolbarButton>

      <div
        style={{
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.15)",
          margin: "0 4px",
        }}
      />

      {/* Block */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        &ldquo;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code Block"
      >
        {"{ }"}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        &mdash;
      </ToolbarButton>

      <div
        style={{
          width: 1,
          height: 16,
          background: "rgba(255,255,255,0.15)",
          margin: "0 4px",
        }}
      />

      {/* Rich elements */}
      <ToolbarButton onClick={addLink} active={editor.isActive("link")} title="Link">
        &#128279;
      </ToolbarButton>
      <ToolbarButton onClick={addImage} title="Image">
        &#128247;
      </ToolbarButton>
      <ToolbarButton onClick={addTable} title="Insert Table">
        &#9638;
      </ToolbarButton>

      {/* Table controls — only visible when cursor is inside a table */}
      {inTable && (
        <>
          <div
            style={{
              width: 1,
              height: 16,
              background: "rgba(255,255,255,0.15)",
              margin: "0 4px",
            }}
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column After"
          >
            +Col
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            −Col
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row After"
          >
            +Row
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            −Row
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            &#10005;Tbl
          </ToolbarButton>
        </>
      )}
    </div>
  );
}

// ─── Editor styles (injected once) ────────────────
const TIPTAP_STYLES = `
.tiptap-editor .ProseMirror {
  outline: none;
  min-height: 100px;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
}
.tiptap-editor .ProseMirror p { margin: 0.25em 0; }
.tiptap-editor .ProseMirror h2 { font-size: 1.25em; font-weight: 700; margin: 0.75em 0 0.25em; }
.tiptap-editor .ProseMirror h3 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.25em; }
.tiptap-editor .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.25em 0; }
.tiptap-editor .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.25em 0; }
.tiptap-editor .ProseMirror li { margin: 0.15em 0; }
.tiptap-editor .ProseMirror blockquote {
  border-left: 3px solid rgba(255,255,255,0.25);
  padding-left: 1em;
  margin: 0.5em 0;
  color: rgba(255,255,255,0.7);
}
.tiptap-editor .ProseMirror code {
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 0.15em 0.3em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
}
.tiptap-editor .ProseMirror pre {
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 0.75em 1em;
  margin: 0.5em 0;
  overflow-x: auto;
}
.tiptap-editor .ProseMirror pre code {
  background: none;
  padding: 0;
  border-radius: 0;
}
.tiptap-editor .ProseMirror a {
  color: #93c5fd;
  text-decoration: underline;
  cursor: pointer;
}
.tiptap-editor .ProseMirror img {
  max-width: 100%;
  border-radius: 8px;
  margin: 0.5em 0;
}
.tiptap-editor .ProseMirror hr {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.15);
  margin: 0.75em 0;
}
.tiptap-editor .ProseMirror .tableWrapper {
  overflow-x: auto;
  margin: 0.5em 0;
}
.tiptap-editor .ProseMirror table {
  border-collapse: collapse;
  margin: 0;
}
.tiptap-editor .ProseMirror th,
.tiptap-editor .ProseMirror td {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 6px 10px;
  text-align: left;
  min-width: 60px;
}
.tiptap-editor .ProseMirror th {
  background: rgba(255,255,255,0.08);
  font-weight: 600;
}
.tiptap-toolbar-btn:hover {
  background: rgba(255,255,255,0.1) !important;
  color: #fff !important;
}
`;

// ─── Main Component ────────────────────────────────
export default function TiptapEditor({
  content,
  onChange,
}: {
  content: string;
  onChange: (html: string) => void;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [inTable, setInTable] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false },
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: false }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getHTML());
      setInTable(e.isActive("tableCell") || e.isActive("tableHeader"));
    },
    onSelectionUpdate: ({ editor: e }) => {
      setInTable(e.isActive("tableCell") || e.isActive("tableHeader"));
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none",
      },
    },
  });

  // Sync external content changes (e.g. switching tasks)
  const lastExternalContent = useRef(content);
  useEffect(() => {
    if (editor && content !== lastExternalContent.current) {
      lastExternalContent.current = content;
      const { from, to } = editor.state.selection;
      editor.commands.setContent(content, { emitUpdate: false });
      // Try to restore cursor position
      try {
        const maxPos = editor.state.doc.content.size;
        editor.commands.setTextSelection({
          from: Math.min(from, maxPos),
          to: Math.min(to, maxPos),
        });
      } catch {
        // ignore if position invalid
      }
    }
  }, [content, editor]);

  // Track content from onUpdate to avoid re-setting on own changes
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      lastExternalContent.current = editor.getHTML();
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);

  return (
    <>
      <style>{TIPTAP_STYLES}</style>
      <div
        className="tiptap-editor rounded-2xl overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <Toolbar editor={editor} inTable={inTable} />
        <div style={{ overflowX: "auto" }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

// ─── Utility: strip HTML for plain-text excerpts ──
export function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
  // SSR fallback
  return html.replace(/<[^>]*>/g, "");
}
