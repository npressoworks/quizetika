'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import styles from './sortable-sorting-list.module.css';

export type SortableSortingItem = {
  id: string;
  text: string;
  correctOrder?: number;
};

type SortableSortingListProps = {
  items: SortableSortingItem[];
  onReorder: (items: SortableSortingItem[]) => void;
  renderItemContent: (item: SortableSortingItem, index: number) => React.ReactNode;
  listClassName?: string;
  itemClassName?: string;
  showIndex?: boolean;
};

function SortableRow({
  id,
  index,
  showIndex,
  children,
  itemClassName,
}: {
  id: string;
  index: number;
  showIndex: boolean;
  children: React.ReactNode;
  itemClassName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isDragging ? styles.itemDragging : ''} ${itemClassName ?? ''}`}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`${index + 1}番目の要素を並び替え`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} aria-hidden />
      </button>
      {showIndex && <span className={styles.itemIndex}>{index + 1}</span>}
      <div className={styles.itemBody}>{children}</div>
    </div>
  );
}

export function SortableSortingList({
  items,
  onReorder,
  renderItemContent,
  listClassName,
  itemClassName,
  showIndex = true,
}: SortableSortingListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={`${styles.list} ${listClassName ?? ''}`}>
          {items.map((item, index) => (
            <SortableRow
              key={item.id}
              id={item.id}
              index={index}
              showIndex={showIndex}
              itemClassName={itemClassName}
            >
              {renderItemContent(item, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/** 並び替え後に correctOrder を 0 始まり連番で再採番する */
export function reindexCorrectOrder<T extends SortableSortingItem>(
  items: T[]
): (T & { correctOrder: number })[] {
  return items.map((item, idx) => ({ ...item, correctOrder: idx }));
}
