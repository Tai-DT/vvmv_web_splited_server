"use client";

import { useCallback, useMemo } from "react";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectPositioner,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { DataTablePaginationProps } from "./types";

export function DataTablePagination<TData>({
	table,
	pagination,
	paginationMeta,
	pageSizeOptions = [5, 10, 20, 50, 100],
}: DataTablePaginationProps<TData>) {
	const pageIndex = pagination.pageIndex;
	const pageSize = pagination.pageSize;
	const currentPage = pageIndex + 1;
	const pageRows = table.getRowModel().rows.length;
	// If API omits or misreports total but this page has rows, avoid showing "of 0"
	const totalRowCount =
		paginationMeta.total > 0 ? paginationMeta.total : pageRows;
	const pageCount = paginationMeta.totalPages;

	// Generate page numbers to display (memoized to prevent recalculation on every render)
	const paginationRange = useMemo(() => {
		const totalPages = pageCount;
		const maxVisiblePages = 5;

		// Handle empty dataset
		if (totalPages === 0) {
			return [];
		}

		// If total pages is less than max visible, show all pages
		if (totalPages <= maxVisiblePages) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}

		const leftSide = currentPage - 2;
		const rightSide = currentPage + 2;

		// Near the start (show first 5 pages)
		if (leftSide <= 1) {
			return Array.from(
				{ length: Math.min(maxVisiblePages, totalPages) },
				(_, i) => i + 1,
			);
		}

		// Near the end (show last 5 pages)
		if (rightSide >= totalPages) {
			const startPage = Math.max(1, totalPages - maxVisiblePages + 1);
			return Array.from({ length: maxVisiblePages }, (_, i) => startPage + i);
		}

		// In the middle (show current page ± 2)
		return Array.from({ length: maxVisiblePages }, (_, i) => leftSide + i);
	}, [currentPage, pageCount]);

	const handlePageClick = (page: number) => {
		table.setPageIndex(page - 1);
	};

	const handlePageSizeChange = useCallback(
		(value: unknown) => {
			const newSize = Number(value);
			if (newSize !== pageSize) {
				table.setPageSize(newSize);
			}
		},
		[pageSize, table],
	);

	return (
		<>
			<div className="hidden sm:grid grid-cols-3 items-center gap-4">
				{/* Page Info - Left side */}
				<div className="text-sm text-muted-foreground whitespace-nowrap">
					{pageCount === 0 ? (
						"No data | Total Rows: 0"
					) : (
						<>
							Page {currentPage} / {pageCount}
						</>
					)}
				</div>

				{/* Pagination Component - Center (truly centered) */}
				<Pagination className="col-start-2 mx-auto">
					<PaginationContent>
						{/* Previous Button */}
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									table.previousPage();
								}}
								aria-disabled={pageIndex === 0 || pageCount === 0}
								className={
									pageIndex === 0 || pageCount === 0
										? "pointer-events-none opacity-50"
										: ""
								}
							/>
						</PaginationItem>

						{/* Page Number Buttons */}
						{paginationRange.map((page) => (
							<PaginationItem key={page}>
								<PaginationLink
									href="#"
									onClick={(e) => {
										e.preventDefault();
										handlePageClick(page);
									}}
									isActive={currentPage === page}
								>
									{page}
								</PaginationLink>
							</PaginationItem>
						))}

						{/* Next Button */}
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									table.nextPage();
								}}
								aria-disabled={pageIndex === pageCount - 1 || pageCount === 0}
								className={
									pageIndex === pageCount - 1 || pageCount === 0
										? "pointer-events-none opacity-50"
										: ""
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>

				<div className="flex items-center gap-2 justify-end">
					<Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
						<SelectTrigger className="w-[80px]">
							<SelectValue />
						</SelectTrigger>
						<SelectPositioner>
							<SelectContent>
								{pageSizeOptions.map((size) => (
									<SelectItem key={size} value={String(size)}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</SelectPositioner>
					</Select>
					<span className="text-sm whitespace-nowrap font-medium">
						of {totalRowCount}
					</span>
				</div>
			</div>{" "}
			<div className="flex items-center sm:hidden">
				{/* Page Info - Left side */}
				<div className="text-sm text-muted-foreground whitespace-nowrap">
					{pageCount === 0 ? (
						"No data | Total Rows: 0"
					) : (
						<>
							Page {currentPage} / {pageCount}
						</>
					)}
				</div>
				{/* Pagination Component - Center (truly centered) */}
				<Pagination className="col-start-2 mx-auto">
					<PaginationContent>
						{/* Previous Button */}
						<PaginationItem>
							<PaginationPrevious
								href="#"
								onClick={(e) => {
									e.preventDefault();
									table.previousPage();
								}}
								aria-disabled={pageIndex === 0 || pageCount === 0}
								className={
									pageIndex === 0 || pageCount === 0
										? "pointer-events-none opacity-50"
										: ""
								}
							/>
						</PaginationItem>

						{/* Next Button */}
						<PaginationItem>
							<PaginationNext
								href="#"
								onClick={(e) => {
									e.preventDefault();
									table.nextPage();
								}}
								aria-disabled={pageIndex === pageCount - 1 || pageCount === 0}
								className={
									pageIndex === pageCount - 1 || pageCount === 0
										? "pointer-events-none opacity-50"
										: ""
								}
							/>
						</PaginationItem>
					</PaginationContent>
				</Pagination>

				<div className="flex items-center gap-2 justify-end">
					<Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
						<SelectTrigger className="w-[100px]">
							<SelectValue />
						</SelectTrigger>
						<SelectPositioner>
							<SelectContent>
								{pageSizeOptions.map((size) => (
									<SelectItem key={size} value={String(size)}>
										{size}
									</SelectItem>
								))}
							</SelectContent>
						</SelectPositioner>
					</Select>
					<span className="text-sm whitespace-nowrap font-medium hidden sm:inline-block">
						of {totalRowCount}
					</span>
				</div>
			</div>
		</>
	);
}
