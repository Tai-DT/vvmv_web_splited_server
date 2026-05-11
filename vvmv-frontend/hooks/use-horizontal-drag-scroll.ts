"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Custom hook that enables horizontal drag-to-scroll on a scrollable container.
 * Users can click and drag left/right to scroll the table horizontally.
 * The cursor changes to a grab hand when hovering, and a grabbing hand while dragging.
 */
export function useHorizontalDragScroll<
	T extends HTMLElement = HTMLDivElement,
>() {
	const containerRef = useRef<T>(null);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const scrollLeft = useRef(0);
	const hasMoved = useRef(false);

	const handleMouseDown = useCallback((e: React.MouseEvent<T>) => {
		const container = containerRef.current;
		if (!container) return;

		// Only activate on middle mouse button or when clicking on empty space (not on interactive elements)
		const target = e.target as HTMLElement;
		const isInteractive =
			target.closest("button") ||
			target.closest("input") ||
			target.closest("select") ||
			target.closest("textarea") ||
			target.closest("a") ||
			target.closest("[role='button']") ||
			target.closest("[role='checkbox']") ||
			target.closest("[role='menuitem']") ||
			target.closest("[draggable='true']") ||
			target.closest("[data-no-drag-scroll]");

		if (isInteractive) return;

		isDragging.current = true;
		hasMoved.current = false;
		startX.current = e.pageX - container.offsetLeft;
		scrollLeft.current = container.scrollLeft;
		container.style.cursor = "grabbing";
		container.style.userSelect = "none";
	}, []);

	const handleMouseMove = useCallback((e: React.MouseEvent<T>) => {
		if (!isDragging.current) return;
		const container = containerRef.current;
		if (!container) return;

		e.preventDefault();
		const x = e.pageX - container.offsetLeft;
		const walk = (x - startX.current) * 1.2;

		if (Math.abs(walk) > 3) {
			hasMoved.current = true;
		}

		const maxScroll = Math.max(
			0,
			container.scrollWidth - container.clientWidth,
		);
		const next = scrollLeft.current - walk;
		container.scrollLeft = Math.max(0, Math.min(maxScroll, next));
	}, []);

	const handleMouseUp = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		isDragging.current = false;
		container.style.cursor = "";
		container.style.userSelect = "";
	}, []);

	const handleMouseLeave = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		if (isDragging.current) {
			isDragging.current = false;
			container.style.cursor = "";
			container.style.userSelect = "";
		}
	}, []);

	// Also handle global mouseup in case user releases mouse outside the container
	useEffect(() => {
		const handleGlobalMouseUp = () => {
			const container = containerRef.current;
			if (container && isDragging.current) {
				isDragging.current = false;
				container.style.cursor = "";
				container.style.userSelect = "";
			}
		};

		window.addEventListener("mouseup", handleGlobalMouseUp);
		return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
	}, []);

	return {
		containerRef,
		dragScrollHandlers: {
			onMouseDown: handleMouseDown,
			onMouseMove: handleMouseMove,
			onMouseUp: handleMouseUp,
			onMouseLeave: handleMouseLeave,
		},
	};
}
