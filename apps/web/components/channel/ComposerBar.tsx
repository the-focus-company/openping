"use client";

import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  CodeSquare,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  AtSign,
  Paperclip,
  Smile,
} from "lucide-react";
import { EmojiPickerPopover } from "@/components/channel/MessageReactions";
import { ToolbarButton } from "./ToolbarButton";

interface ComposerBarProps {
  editor: Editor;
  showActions: boolean;
  onTriggerMention: () => void;
  onAttachFile?: () => void;
}

export function ComposerBar({ editor, showActions, onTriggerMention, onAttachFile }: ComposerBarProps) {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      editor.commands.insertContent(emoji);
      editor.commands.focus();
    },
    [editor]
  );

  const toolbarRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const first = node.querySelector<HTMLElement>("[data-toolbar-item]:not(:disabled)");
    if (first) first.tabIndex = 0;
  }, []);

  const handleToolbarKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    const toolbar = e.currentTarget;
    const items = Array.from(toolbar.querySelectorAll<HTMLElement>("[data-toolbar-item]:not(:disabled)"));
    if (items.length === 0) return;
    const idx = items.indexOf(e.target as HTMLElement);
    if (idx === -1) return;
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "ArrowRight") next = idx < items.length - 1 ? idx + 1 : 0;
    else next = idx > 0 ? idx - 1 : items.length - 1;
    e.preventDefault();
    items.forEach((el, i) => { el.tabIndex = i === next ? 0 : -1; });
    items[next].focus();
  }, []);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5"
      onKeyDown={handleToolbarKeyDown}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough (⌘⇧X)"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-foreground/10" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline code (⌘E)"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        title="Code block"
      >
        <CodeSquare className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-foreground/10" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-foreground/10" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={setLink}
        isActive={editor.isActive("link")}
        title="Link"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      {showActions && (
        <>
          <div className="mx-1 h-4 w-px bg-foreground/10" />

          <ToolbarButton
            onClick={onTriggerMention}
            title="Mention (@)"
          >
            <AtSign className="h-3.5 w-3.5" />
          </ToolbarButton>
          <EmojiPickerPopover onSelect={handleEmojiSelect}>
            <button
              type="button"
              data-toolbar-item
              tabIndex={-1}
              aria-label="Emoji"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              title="Emoji"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
          </EmojiPickerPopover>
          <ToolbarButton
            onClick={() => onAttachFile?.()}
            disabled={!onAttachFile}
            title={onAttachFile ? "Attach files" : "File attachments coming soon"}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
