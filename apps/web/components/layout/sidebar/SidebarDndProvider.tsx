"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { SidebarSectionModel } from "@/hooks/useSidebarLayout";

interface SidebarDndProviderProps {
  enabled: boolean;
  sections: SidebarSectionModel[];
  onReorderItems: (
    sectionId: string,
    itemIds: string[],
  ) => void;
  onMoveItemToSection: (
    itemId: string,
    toSectionId: string,
  ) => void;
  children: React.ReactNode;
}

export function SidebarDndProvider({
  enabled,
  sections,
  onReorderItems,
  onMoveItemToSection,
  children,
}: SidebarDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Find which section contains the active item
      let fromSection: SidebarSectionModel | undefined;
      for (const section of sections) {
        if (section.items.some((i) => i.id === active.id)) {
          fromSection = section;
          break;
        }
      }
      if (!fromSection) return;

      // Determine target: is `over` an item or a section droppable?
      const overId = String(over.id);

      // Check if over is a section droppable (prefixed with "section-")
      if (overId.startsWith("section-")) {
        const toSectionId = overId.replace("section-", "");
        if (toSectionId !== fromSection.id) {
          onMoveItemToSection(
              String(active.id),
              toSectionId,
            );
        }
        return;
      }

      // Over is another item — find its section
      let toSection: SidebarSectionModel | undefined;
      for (const section of sections) {
        if (section.items.some((i) => i.id === over.id)) {
          toSection = section;
          break;
        }
      }
      if (!toSection) return;

      if (fromSection.id === toSection.id) {
        // Reorder within same section
        const itemIds = fromSection.items.map((i) => i.id);
        const oldIndex = itemIds.indexOf(String(active.id));
        const newIndex = itemIds.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = [...itemIds];
        reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, String(active.id));

        onReorderItems(fromSection.id, reordered);
      } else {
        // Move to different section
        onMoveItemToSection(
            String(active.id),
            toSection.id,
          );
      }
    },
    [sections, onReorderItems, onMoveItemToSection],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      <DragOverlay>
        {activeId && (
          <div className="rounded bg-surface-2 px-2 py-1 text-xs text-foreground shadow-lg border border-subtle opacity-80">
            Moving...
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
