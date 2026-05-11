"use client";

import type { Table } from "@tanstack/react-table";
import { useState } from "react";

export function useDragDropColumns(table: Table<any>) {
	const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
	const [dropTargetColumnId, setDropTargetColumnId] = useState<string | null>(
		null,
	);

	const handleDragStart = (e: React.DragEvent, columnId: string) => {
		setDraggedColumnId(columnId);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", columnId);

		// Use the parent TableHead as drag image (whole column header)
		const gripElement = e.currentTarget as HTMLElement;
		const tableHead = gripElement.closest("th");
		if (tableHead) {
			const clone = tableHead.cloneNode(true) as HTMLElement;
			clone.style.position = "absolute";
			clone.style.top = "-1000px";
			clone.style.opacity = "0.9";
			clone.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
			document.body.appendChild(clone);
			e.dataTransfer.setDragImage(clone, 20, 20);
			setTimeout(() => document.body.removeChild(clone), 0);
		}
	};

	const handleDragOver = (e: React.DragEvent, targetColumnId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (draggedColumnId && targetColumnId !== draggedColumnId) {
			setDropTargetColumnId(targetColumnId);
		}
	};

	const handleDragLeave = () => {
		setDropTargetColumnId(null);
	};

	const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
		e.preventDefault();
		setDropTargetColumnId(null);
		if (!draggedColumnId || draggedColumnId === targetColumnId) {
			setDraggedColumnId(null);
			return;
		}

		const currentOrder = table.getState().columnOrder;
		const newOrder = [...currentOrder];
		const draggedIndex = newOrder.indexOf(draggedColumnId);
		const targetIndex = newOrder.indexOf(targetColumnId);

		if (draggedIndex !== -1 && targetIndex !== -1) {
			newOrder.splice(draggedIndex, 1);
			newOrder.splice(targetIndex, 0, draggedColumnId);
			table.setColumnOrder(newOrder);
		}

		setDraggedColumnId(null);
	};

	const handleDragEnd = () => {
		setDraggedColumnId(null);
		setDropTargetColumnId(null);
	};

	// Get drop indicator position (left or right side of target)
	const getDropPosition = (targetColumnId: string): "left" | "right" | null => {
		if (
			!draggedColumnId ||
			!dropTargetColumnId ||
			dropTargetColumnId !== targetColumnId
		) {
			return null;
		}
		const currentOrder = table.getState().columnOrder;
		const draggedIndex = currentOrder.indexOf(draggedColumnId);
		const targetIndex = currentOrder.indexOf(targetColumnId);
		return draggedIndex < targetIndex ? "right" : "left";
	};

	return {
		draggedColumnId,
		dropTargetColumnId,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleDragEnd,
		getDropPosition,
	};
}
