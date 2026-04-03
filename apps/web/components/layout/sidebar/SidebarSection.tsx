"use client";

import { ChevronRight, MoreHorizontal, Pencil, Trash2, Plus, Star, ArrowDownAZ, Clock, GripVertical, Check } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator as CtxSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { SidebarItem } from "./SidebarItem";
import { cn } from "@/lib/utils";
import type { SidebarSectionModel, SortMode } from "@/hooks/useSidebarLayout";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";

const sortModeOptions: { mode: SortMode; label: string; icon: React.ElementType }[] = [
  { mode: "alphabetical", label: "A-Z", icon: ArrowDownAZ },
  { mode: "recent", label: "Recent", icon: Clock },
  { mode: "custom", label: "Custom", icon: GripVertical },
];

interface SidebarSectionProps {
  section: SidebarSectionModel;
  onlineUserIds: Set<string>;
  userId?: string;
  buildPath: (p: string) => string;
  pathname: string;
  allSections: SidebarSectionModel[];
  onToggleCollapse: (sectionId: string) => void;
  onRename: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
  onCreateSection: () => void;
  onToggleStar: (itemId: string) => void;
  onMoveItemToSection: (
    itemId: string,
    targetSectionId: string,
  ) => void;
  onChangeSortMode: (sectionId: string, mode: SortMode) => void;
}

export function SidebarSection({
  section,
  onlineUserIds,
  userId,
  buildPath,
  pathname,
  allSections,
  onToggleCollapse,
  onRename,
  onDelete,
  onCreateSection,
  onToggleStar,
  onMoveItemToSection,
  onChangeSortMode,
}: SidebarSectionProps) {
  const sortMode = section.sortMode;
  const { setNodeRef } = useDroppable({
    id: `section-${section.id}`,
    data: { type: "section", sectionId: section.id },
  });

  const itemIds = section.items.map((i) => i.id);

  // Local collapse state for the virtual favorites section
  const [favCollapsed, setFavCollapsed] = useState(false);

  if (section.isFavorites) {
    return (
      <Collapsible
        open={!favCollapsed}
        onOpenChange={() => setFavCollapsed(!favCollapsed)}
      >
        <div className="group/sec flex items-center justify-between px-1 pb-0.5 pt-3">
          <CollapsibleTrigger className="flex flex-1 items-center gap-1 text-2xs font-medium uppercase tracking-widest text-foreground/50 transition-colors hover:text-foreground/70">
            <Star
              className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400"
            />
            <span className="truncate">{section.name}</span>
            {section.items.length > 0 && (
              <span className="ml-1 text-foreground/30">
                {section.items.length}
              </span>
            )}
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="min-h-[2px]">
            {section.items.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                sortMode={sortMode}
                inFavorites
                onlineUserIds={onlineUserIds}
                userId={userId}
                buildPath={buildPath}
                pathname={pathname}
                onToggleStar={onToggleStar}
                onMoveToSection={onMoveItemToSection}
                sections={allSections}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Collapsible
          open={!section.isCollapsed}
          onOpenChange={() => onToggleCollapse(section.id)}
        >
          <div className="group/sec flex items-center justify-between px-1 pb-0.5 pt-3">
            <CollapsibleTrigger className="flex flex-1 items-center gap-1 text-2xs font-medium uppercase tracking-widest text-foreground/50 transition-colors hover:text-foreground/70">
              <ChevronRight
                className={cn(
                  "h-3 w-3 shrink-0 transition-transform duration-150",
                  !section.isCollapsed && "rotate-90",
                )}
              />
              <span className="truncate">{section.name}</span>
              {section.items.length > 0 && (
                <span className="ml-1 text-foreground/30">
                  {section.items.length}
                </span>
              )}
            </CollapsibleTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded p-0.5 text-foreground/30 opacity-0 transition-all hover:bg-surface-3 hover:text-foreground/60 group-hover/sec:opacity-100 focus-visible:opacity-100"
                  tabIndex={-1}
                  aria-label="Section options"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-44 bg-surface-2 border-subtle"
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer text-xs">
                    Sort by
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-surface-2 border-subtle">
                    {sortModeOptions.map(({ mode, label, icon: MIcon }) => (
                      <DropdownMenuItem
                        key={mode}
                        className="cursor-pointer text-xs"
                        onClick={() => onChangeSortMode(section.id, mode)}
                      >
                        <MIcon className="mr-2 h-3 w-3" />
                        <span className="flex-1">{label}</span>
                        {sortMode === mode && (
                          <Check className="ml-2 h-3 w-3 text-ping-purple" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator className="bg-foreground/5" />
                {!section.isDefault && (
                  <>
                    <DropdownMenuItem
                      className="cursor-pointer text-xs"
                      onClick={() => onRename(section.id)}
                    >
                      <Pencil className="mr-2 h-3 w-3" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-xs text-destructive focus:text-destructive"
                      onClick={() => onDelete(section.id)}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete section
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-foreground/5" />
                  </>
                )}
                <DropdownMenuItem
                  className="cursor-pointer text-xs"
                  onClick={onCreateSection}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  New section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <CollapsibleContent>
            <div ref={setNodeRef} className="min-h-[2px]">
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                {section.items.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    sortMode={sortMode}
                    onlineUserIds={onlineUserIds}
                    userId={userId}
                    buildPath={buildPath}
                    pathname={pathname}
                    onToggleStar={onToggleStar}
                    onMoveToSection={onMoveItemToSection}
                    sections={allSections}
                  />
                ))}
              </SortableContext>
              {section.items.length === 0 && (
                <div className="px-2 py-2 text-2xs text-foreground/30">
                  {sortMode === "custom"
                    ? "Drag items here"
                    : "No items in this section"}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44 bg-surface-2 border-subtle">
        <ContextMenuSub>
          <ContextMenuSubTrigger className="cursor-pointer text-xs">
            Sort by
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-surface-2 border-subtle">
            {sortModeOptions.map(({ mode, label, icon: MIcon }) => (
              <ContextMenuItem
                key={mode}
                className="cursor-pointer text-xs"
                onClick={() => onChangeSortMode(section.id, mode)}
              >
                <MIcon className="mr-2 h-3 w-3" />
                <span className="flex-1">{label}</span>
                {sortMode === mode && (
                  <Check className="ml-2 h-3 w-3 text-ping-purple" />
                )}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <CtxSeparator />
        {!section.isDefault && (
          <>
            <ContextMenuItem
              className="cursor-pointer text-xs"
              onClick={() => onRename(section.id)}
            >
              <Pencil className="mr-2 h-3 w-3" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              className="cursor-pointer text-xs text-destructive focus:text-destructive"
              onClick={() => onDelete(section.id)}
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Delete section
            </ContextMenuItem>
            <CtxSeparator />
          </>
        )}
        <ContextMenuItem
          className="cursor-pointer text-xs"
          onClick={() =>
            onToggleCollapse(section.id)
          }
        >
          {section.isCollapsed ? "Expand" : "Collapse"}
        </ContextMenuItem>
        <CtxSeparator />
        <ContextMenuItem
          className="cursor-pointer text-xs"
          onClick={onCreateSection}
        >
          <Plus className="mr-2 h-3 w-3" />
          New section
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
