"use client";

import {
	AlertTriangle,
	Download,
	FileSpreadsheet,
	Loader2,
	Plus,
	RefreshCw,
	Save,
	Search,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import type React from "react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { getFetchErrorMessage } from "@/lib/api/client";
import {
	buildCargoListClientIssues,
	type CargoPanelValidationIssue,
} from "@/lib/followup/cargo-list-validation";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";
import { cn } from "@/lib/utils";
import type { CargoListRow } from "../../types";
import {
	type CargoColumn,
	FOLLOWUP_CARGO_COLUMNS,
	FOLLOWUP_CARGO_VISIBLE_KEYS,
} from "./panel-config";

// Format date to Vietnamese format DD/MM/YYYY
function formatDateVN(dateValue: string | null | undefined): string {
	if (!dateValue) return "";

	// If already in DD/MM/YYYY format, return as-is
	if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
		return dateValue;
	}

	try {
		const date = new Date(dateValue);
		if (Number.isNaN(date.getTime())) return dateValue;

		const day = date.getDate().toString().padStart(2, "0");
		const month = (date.getMonth() + 1).toString().padStart(2, "0");
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	} catch {
		return dateValue;
	}
}

const CARGO_COLUMNS = FOLLOWUP_CARGO_COLUMNS;

type ColumnKey = CargoColumn["key"];

type CargoUnitOption = {
	code: string;
	name: string | null;
	nameVn: string | null;
	usedCount: number;
	appUnitCount: number;
	unit2Count: number;
	inSdvtMaster: boolean;
};

const CARGO_COLUMN_LABELS = Object.fromEntries(
	CARGO_COLUMNS.map((column) => [column.key, column.label]),
) as Record<ColumnKey, string>;

const MOBILE_WIDE_FIELDS = new Set<ColumnKey>([
	"vietnameseName",
	"originalCargoName",
	"imExDutyExemptionCode",
	"imExDutyExemptionCondition",
]);

const CDS_LAYOUT_STORAGE_KEY = "vvmv:cargo-list-panel:cds-layout";
const MAX_VISIBLE_ISSUES = 12;

function getCargoIssueMeta(path: string): {
	rowIndex: number | null;
	columnKey: ColumnKey | null;
} {
	const match = path.match(/^cargoList\[(\d+)\]\.(.+)$/);
	if (!match) {
		return { rowIndex: null, columnKey: null };
	}

	const rowIndex = Number.parseInt(match[1] ?? "", 10);
	const columnKey = CARGO_COLUMNS.some((column) => column.key === match[2])
		? (match[2] as ColumnKey)
		: null;

	return {
		rowIndex: Number.isNaN(rowIndex) ? null : rowIndex,
		columnKey,
	};
}

function getHighestSeverity(
	issues: CargoPanelValidationIssue[],
): CargoPanelValidationIssue["severity"] | null {
	if (issues.some((issue) => issue.severity === "error")) return "error";
	if (issues.some((issue) => issue.severity === "warning")) return "warning";
	if (issues.some((issue) => issue.severity === "info")) return "info";
	return null;
}

function getIssueInputClassName(
	issueSeverity: CargoPanelValidationIssue["severity"] | null,
	baseClassName: string,
) {
	return cn(
		baseClassName,
		issueSeverity === "error" &&
			"border border-red-200 bg-red-50/80 focus:bg-red-50 focus:border-red-300",
		issueSeverity === "warning" &&
			"border border-amber-200 bg-amber-50/80 focus:bg-amber-50 focus:border-amber-300",
		issueSeverity === "info" &&
			"border border-sky-200 bg-sky-50/80 focus:bg-sky-50 focus:border-sky-300",
		!issueSeverity &&
			"border-0 bg-transparent focus:bg-white focus:border focus:border-primary",
	);
}

function getIssueBadgeVariant(
	issues:
		| { total: number; error: number; warning: number; info: number }
		| undefined,
) {
	if (!issues?.total) {
		return "secondary" as const;
	}

	if (issues.error > 0) {
		return "destructive" as const;
	}

	if (issues.warning > 0) {
		return "warning" as const;
	}

	return "info" as const;
}

interface CargoListPanelProps {
	followUpId: string;
	onRefresh?: () => void;
	onDataChange?: (items: Partial<CargoListRow>[]) => void;
	operationCode?: string | null;
	initialAction?: "default" | "add";
	variant?: "default" | "cdsInfo";
	readOnly?: boolean;
	readOnlyReason?: string | null;
}

export interface CargoListPanelHandle {
	save: (options?: { quietSuccess?: boolean }) => Promise<boolean>;
	getRows: () => Partial<CargoListRow>[];
}

function hasEditableCargoValues(row: Partial<CargoListRow> | undefined) {
	if (!row) {
		return false;
	}

	return Object.entries(row).some(([key, value]) => {
		if (
			key === "id" ||
			key === "followUpId" ||
			key === "createdAt" ||
			key === "updatedAt"
		) {
			return false;
		}

		return value !== null && value !== undefined && value !== "";
	});
}

function getPersistableCargoRows(rows: Partial<CargoListRow>[]) {
	return rows.filter((row) => hasEditableCargoValues(row));
}

function normalizeImportHeader(value: unknown) {
	return String(value ?? "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function getHeaderColumnKey(header: string): ColumnKey | null {
	const normalizedHeader = normalizeImportHeader(header);
	if (!normalizedHeader) {
		return null;
	}

	for (const column of CARGO_COLUMNS) {
		const aliases = [column.label, column.key, ...(column.headerAliases ?? [])];
		if (
			aliases.some((alias) => normalizeImportHeader(alias) === normalizedHeader)
		) {
			return column.key;
		}
	}

	return null;
}

function hasImportedRowValues(row: Partial<CargoListRow>) {
	return CARGO_COLUMNS.some((column) => {
		const value = row[column.key];
		return value !== null && value !== undefined && String(value).trim() !== "";
	});
}

function parseImportedCargoCell(column: CargoColumn, rawValue: unknown) {
	const textValue = String(rawValue ?? "").trim();

	if (!textValue) {
		return column.type === "number" ? null : "";
	}

	if (column.type === "number") {
		return normalizeLooseNumber(textValue);
	}

	return textValue;
}

function normalizeCargoSearchText(value: unknown) {
	return String(value ?? "")
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function parsePixelWidth(width?: string) {
	const numericWidth = Number.parseFloat(width ?? "0");
	return Number.isFinite(numericWidth) ? numericWidth : 0;
}

function isCargoUnitColumn(columnKey: ColumnKey) {
	return columnKey === "unit" || columnKey === "unit2";
}

function isCargoUnitOption(value: unknown): value is CargoUnitOption {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const option = value as Partial<CargoUnitOption>;
	return typeof option.code === "string" && option.code.trim() !== "";
}

function getCargoUnitOptionLabel(option: CargoUnitOption) {
	const name = option.nameVn ?? option.name;
	const usage =
		option.usedCount > 0
			? `Dùng: ${option.usedCount.toLocaleString("vi-VN")}`
			: null;
	const source = option.inSdvtMaster ? "SDVT" : "Ngoài SDVT";

	return [name, usage, source].filter(Boolean).join(" | ");
}

function getCargoRowTitle(item: Partial<CargoListRow>) {
	return (
		item.vietnameseName ||
		item.originalCargoName ||
		item.customCode ||
		"Chưa có tên hàng"
	);
}

function getCargoRowSummaryBadges(item: Partial<CargoListRow>) {
	const parts = [
		item.customCode ? `Mã hàng: ${item.customCode}` : null,
		item.hsCode ? `HS: ${item.hsCode}` : null,
		item.qty != null && Number.isFinite(Number(item.qty))
			? `Lượng: ${item.qty}`
			: item.qty != null
				? `Lượng: —`
				: null,
		item.unit ? `ĐVT: ${item.unit}` : null,
	].filter((value): value is string => Boolean(value));

	return parts.slice(0, 3);
}

function parseCargoRowsFromSheet(
	rawRows: unknown[][],
	followUpId: string,
): Partial<CargoListRow>[] {
	const rows = rawRows
		.map((row) => row.map((cell) => String(cell ?? "").trim()))
		.filter((row) => row.some((cell) => cell !== ""));

	if (rows.length === 0) {
		return [];
	}

	const headerKeys = rows[0]?.map((cell) => getHeaderColumnKey(cell)) ?? [];
	const matchedHeaderCount = headerKeys.filter(Boolean).length;
	const useHeaderRow = matchedHeaderCount >= 3;
	const contentRows = useHeaderRow ? rows.slice(1) : rows;

	return contentRows
		.map((row) => {
			const nextRow = {
				followUpId,
			} as Partial<CargoListRow> &
				Record<string, string | number | null | undefined>;

			if (useHeaderRow) {
				headerKeys.forEach((columnKey, columnIndex) => {
					if (!columnKey) {
						return;
					}

					const column = CARGO_COLUMNS.find((item) => item.key === columnKey);
					if (!column) {
						return;
					}

					(nextRow as Record<string, string | number | null | undefined>)[
						column.key
					] = parseImportedCargoCell(column, row[columnIndex]);
				});
			} else {
				CARGO_COLUMNS.forEach((column, columnIndex) => {
					(nextRow as Record<string, string | number | null | undefined>)[
						column.key
					] = parseImportedCargoCell(column, row[columnIndex]);
				});
			}

			return nextRow;
		})
		.filter(hasImportedRowValues);
}

const CargoListPanelInner = forwardRef<
	CargoListPanelHandle,
	CargoListPanelProps
>(function CargoListPanelInner(
	{
		followUpId,
		onRefresh,
		onDataChange,
		operationCode,
		initialAction = "default",
		variant = "default",
		readOnly = false,
		readOnlyReason = null,
	},
	ref,
) {
	const isCdsInfoVariant = variant === "cdsInfo";
	const isMobile = useIsMobile();
	const shouldUseWideDesktopTable = isCdsInfoVariant;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const mobileCardsRef = useRef<HTMLDivElement>(null);
	const desktopTableScrollRef = useRef<HTMLDivElement>(null);
	const persistedSnapshotRef = useRef("[]");
	const cargoFetchRequestIdRef = useRef(0);
	const [data, setData] = useState<Partial<CargoListRow>[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isClearing, setIsClearing] = useState(false);
	const [isImporting, setIsImporting] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [didApplyInitialAction, setDidApplyInitialAction] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [showOnlyIssueRows, setShowOnlyIssueRows] = useState(false);
	const [cargoUnitOptions, setCargoUnitOptions] = useState<CargoUnitOption[]>(
		[],
	);
	const [preferredCdsLayout, setPreferredCdsLayout] = useState<
		"table" | "cards"
	>(() => {
		if (typeof window === "undefined") {
			return "table";
		}

		const savedLayout = window.localStorage.getItem(CDS_LAYOUT_STORAGE_KEY);
		return savedLayout === "cards" || savedLayout === "table"
			? savedLayout
			: "table";
	});
	const [searchQuery, setSearchQuery] = useState("");

	useEffect(() => {
		if (!isCdsInfoVariant) {
			return;
		}

		const savedLayout =
			typeof window !== "undefined"
				? window.localStorage.getItem(CDS_LAYOUT_STORAGE_KEY)
				: null;

		if (savedLayout === "cards" || savedLayout === "table") {
			setPreferredCdsLayout(savedLayout);
			return;
		}

		setPreferredCdsLayout(isMobile ? "cards" : "table");
	}, [isCdsInfoVariant, isMobile]);

	useEffect(() => {
		if (!isCdsInfoVariant || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(CDS_LAYOUT_STORAGE_KEY, preferredCdsLayout);
	}, [isCdsInfoVariant, preferredCdsLayout]);

	// Helper to create empty row
	const createEmptyRow = useCallback(
		(): Partial<CargoListRow> => ({
			customCode: "",
			hsCode: "",
			originalCountry: "",
			originalCargoName: "",
			dutyReductionCode: "",
			imExDutyExemptionCode: "",
			qty: null,
			unit: "",
			unitPrice: null,
			totalPrice: null,
			lineTaxableValue: null,
			exportTaxRatePercent: null,
			exportTaxAmount: null,
			taxableUnitPrice: null,
			qty2: null,
			unit2: "",
			vietnameseName: "",
			importTaxCode: "",
			importTaxRate: null,
			importTaxAmount: null,
			vatTaxCode: "",
			vatTaxRate: null,
			vatTaxAmount: null,
			imExDutyExemptionCondition: "",
			imExDutyExemptionAmount: null,
			importer: "",
			packageQty: null,
			packageType: "",
			grossWeight: null,
			invoiceNo: "",
			invoiceDate: "",
			term: "",
			followUpId: followUpId,
		}),
		[followUpId],
	);

	// Lazy load cargo list when component mounts
	const fetchCargoList = useCallback(async () => {
		const requestId = cargoFetchRequestIdRef.current + 1;
		cargoFetchRequestIdRef.current = requestId;
		setIsLoading(true);
		setLoadError(null);
		try {
			const response = await fetch(`/api/followup/${followUpId}/cargo`);
			if (!response.ok) {
				throw new Error(
					await getFetchErrorMessage(response, "Failed to load cargo list"),
				);
			}
			const items = await response.json();
			const normalizedItems = Array.isArray(items) ? items : [];

			if (cargoFetchRequestIdRef.current !== requestId) {
				return;
			}

			persistedSnapshotRef.current = JSON.stringify(
				getPersistableCargoRows(normalizedItems),
			);
			setHasUnsavedChanges(false);
			setShowOnlyIssueRows(false);

			// If no items, add one empty row so user can start editing
			if (normalizedItems.length === 0) {
				setData([createEmptyRow()]);
			} else {
				setData(normalizedItems);
			}
		} catch (error) {
			if (cargoFetchRequestIdRef.current !== requestId) {
				return;
			}
			console.error("Fetch cargo error:", error);
			setLoadError(error instanceof Error ? error.message : "Failed to load");
		} finally {
			if (cargoFetchRequestIdRef.current === requestId) {
				setIsLoading(false);
			}
		}
	}, [createEmptyRow, followUpId]);

	useEffect(() => {
		setDidApplyInitialAction(false);
		fetchCargoList();
	}, [fetchCargoList]);

	useEffect(() => {
		if (didApplyInitialAction || isLoading || initialAction !== "add") {
			return;
		}

		setData((prev) => {
			if (prev.length === 0) {
				return [createEmptyRow()];
			}

			if (prev.length === 1 && !hasEditableCargoValues(prev[0])) {
				return prev;
			}

			return [...prev, createEmptyRow()];
		});
		setDidApplyInitialAction(true);
	}, [createEmptyRow, didApplyInitialAction, initialAction, isLoading]);

	const persistableRows = useMemo(() => getPersistableCargoRows(data), [data]);
	const persistedRowsSnapshot = useMemo(
		() => JSON.stringify(persistableRows),
		[persistableRows],
	);
	const normalizedSearchQuery = useMemo(
		() => normalizeCargoSearchText(searchQuery),
		[searchQuery],
	);
	const cargoUnitDatalistId = useMemo(
		() => `cargo-unit-codes-${followUpId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
		[followUpId],
	);
	const clientIssues = useMemo(
		() =>
			buildCargoListClientIssues(data, { operationCode }).filter((issue) => {
				const { columnKey } = getCargoIssueMeta(issue.path);
				return columnKey !== null && FOLLOWUP_CARGO_VISIBLE_KEYS.has(columnKey);
			}),
		[data, operationCode],
	);
	const allIssues = clientIssues;
	const blockingIssues = useMemo(
		() => allIssues.filter((issue) => issue.severity === "error"),
		[allIssues],
	);
	const issuesByPath = useMemo(() => {
		const map = new Map<string, CargoPanelValidationIssue[]>();

		for (const issue of allIssues) {
			const current = map.get(issue.path) ?? [];
			current.push(issue);
			map.set(issue.path, current);
		}

		return map;
	}, [allIssues]);
	const rowIssueCounts = useMemo(() => {
		const map = new Map<
			number,
			{ total: number; error: number; warning: number; info: number }
		>();

		for (const issue of allIssues) {
			const { rowIndex } = getCargoIssueMeta(issue.path);
			if (rowIndex === null) continue;

			const current = map.get(rowIndex) ?? {
				total: 0,
				error: 0,
				warning: 0,
				info: 0,
			};

			current.total += 1;
			if (issue.severity === "error") current.error += 1;
			else if (issue.severity === "warning") current.warning += 1;
			else current.info += 1;
			map.set(rowIndex, current);
		}

		return map;
	}, [allIssues]);
	const issueRowIndexes = useMemo(
		() => new Set(Array.from(rowIssueCounts.keys())),
		[rowIssueCounts],
	);
	const visibleRows = useMemo(() => {
		const indexedRows = data.map((item, index) => ({ item, index }));

		return indexedRows.filter(({ item, index }) => {
			if (showOnlyIssueRows && !issueRowIndexes.has(index)) {
				return false;
			}

			if (!normalizedSearchQuery) {
				return true;
			}

			if (normalizeCargoSearchText(index + 1).includes(normalizedSearchQuery)) {
				return true;
			}

			return CARGO_COLUMNS.some((column) =>
				normalizeCargoSearchText(item[column.key]).includes(
					normalizedSearchQuery,
				),
			);
		});
	}, [data, issueRowIndexes, normalizedSearchQuery, showOnlyIssueRows]);
	const visibleRowCountLabel =
		normalizedSearchQuery || showOnlyIssueRows
			? `${visibleRows.length}/${data.length} dòng hiển thị`
			: `${data.length} dòng hiển thị`;
	const showFilteredEmptyState =
		(normalizedSearchQuery.length > 0 || showOnlyIssueRows) &&
		visibleRows.length === 0;
	const emptyStateMessage = showOnlyIssueRows
		? normalizedSearchQuery
			? "Không có dòng lỗi/cảnh báo nào khớp với bộ lọc hiện tại."
			: "Hiện không có dòng nào chứa lỗi hoặc cảnh báo."
		: "Không tìm thấy dòng hàng khớp với bộ lọc hiện tại.";
	const showMobileCards = isCdsInfoVariant
		? preferredCdsLayout === "cards"
		: true;
	const showDesktopTable = isCdsInfoVariant
		? preferredCdsLayout === "table"
		: true;
	const saveStatusLabel = isLoading
		? "Đang tải..."
		: loadError
			? "Chưa đồng bộ"
			: hasUnsavedChanges
				? "Chưa lưu thay đổi"
				: "Đã đồng bộ";

	useEffect(() => {
		if (!isCdsInfoVariant) {
			setCargoUnitOptions([]);
			return;
		}

		const controller = new AbortController();

		fetch("/api/followup/cargo-unit-codes", { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error("Không thể tải danh mục đơn vị tính hàng hóa CDS");
				}

				return response.json() as Promise<{ units?: unknown[] }>;
			})
			.then((payload) => {
				setCargoUnitOptions((payload.units ?? []).filter(isCargoUnitOption));
			})
			.catch((error) => {
				if (error instanceof DOMException && error.name === "AbortError") {
					return;
				}

				console.warn("Failed to load CDS cargo unit codes:", error);
				setCargoUnitOptions([]);
			});

		return () => controller.abort();
	}, [isCdsInfoVariant]);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		setHasUnsavedChanges(
			persistedRowsSnapshot !== persistedSnapshotRef.current,
		);
	}, [isLoading, persistedRowsSnapshot]);

	useEffect(() => {
		if (isLoading || loadError) {
			return;
		}

		onDataChange?.(persistableRows);
	}, [isLoading, loadError, onDataChange, persistableRows]);

	// Handle cell value change
	const handleCellChange = useCallback(
		(rowIndex: number, columnKey: ColumnKey, value: string) => {
			if (readOnly) {
				return;
			}

			setData((prev) => {
				const newData = [...prev];
				const column = CARGO_COLUMNS.find((c) => c.key === columnKey);

				let parsedValue: string | number = value;
				if (column?.type === "number") {
					parsedValue = normalizeLooseNumber(value) ?? "";
				}

				newData[rowIndex] = {
					...newData[rowIndex],
					[columnKey]: parsedValue,
				};
				return newData;
			});
		},
		[readOnly],
	);

	const clearActiveFilters = useCallback(() => {
		setSearchQuery("");
		setShowOnlyIssueRows(false);
	}, []);

	const focusIssueField = useCallback(
		(rowIndex: number | null, columnKey: ColumnKey | null) => {
			if (
				rowIndex === null ||
				columnKey === null ||
				typeof window === "undefined"
			) {
				return;
			}

			const targetLayout = isMobile ? "cards" : "table";
			if (isCdsInfoVariant) {
				setPreferredCdsLayout(targetLayout);
			}

			const focusTarget = () => {
				const nextLayout = isCdsInfoVariant
					? targetLayout
					: isMobile
						? "cards"
						: "table";
				const scope =
					nextLayout === "cards"
						? mobileCardsRef.current
						: desktopTableScrollRef.current;
				const selector = `[data-cargo-input="true"][data-row-index="${rowIndex}"][data-column-key="${columnKey}"]`;
				const input = scope?.querySelector<HTMLInputElement>(selector);

				if (!input) {
					return;
				}

				input.scrollIntoView({
					block: "center",
					inline: "center",
					behavior: "smooth",
				});
				input.focus();
				input.select?.();
			};

			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(focusTarget);
			});
		},
		[isCdsInfoVariant, isMobile],
	);

	// Handle paste for multiple rows or columns
	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			if (readOnly) {
				e.preventDefault();
				toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
				return;
			}

			const target = e.target as HTMLElement;
			const clipboardData = e.clipboardData.getData("text");
			const rows = clipboardData
				.split(/\r?\n/)
				.filter((row) => row.trim() !== "");

			// Check if we're pasting into an input (cell paste - single or multiple columns)
			if (target.tagName === "INPUT") {
				const input = target as HTMLInputElement;

				// Check if the pasted data has multiple lines or multiple columns
				const hasMultipleRows = rows.length > 1;
				const hasMultipleColumns = rows.some((row) => row.includes("\t"));

				if (hasMultipleRows || hasMultipleColumns) {
					e.preventDefault();

					// Find which column and row we're pasting into
					const cell = input.closest("td");
					const tableRow = cell?.closest("tr");
					const tbody = tableRow?.closest("tbody");

					if (cell && tableRow && tbody) {
						const allCells = Array.from(tableRow.querySelectorAll("td"));
						const cellIndex = allCells.indexOf(cell);
						const startColumnIndex = cellIndex - 1; // -1 because first column is row number

						const allRows = Array.from(tbody.querySelectorAll("tr"));
						const startRowIndex = allRows.indexOf(tableRow);

						if (
							startColumnIndex >= 0 &&
							startColumnIndex < CARGO_COLUMNS.length
						) {
							setData((prev) => {
								const newData = [...prev];

								// Add more rows if needed
								while (newData.length < startRowIndex + rows.length) {
									newData.push(createEmptyRow());
								}

								// Paste values into cells
								rows.forEach((rowText, rowOffset) => {
									const rowIndex = startRowIndex + rowOffset;
									const cellValues = rowText.split("\t");

									cellValues.forEach((value, colOffset) => {
										const columnIndex = startColumnIndex + colOffset;

										// Don't paste beyond available columns
										if (columnIndex >= CARGO_COLUMNS.length) return;

										const column = CARGO_COLUMNS[columnIndex];
										let parsedValue: string | number = value.trim();

										if (column.type === "number") {
											parsedValue = normalizeLooseNumber(value) ?? "";
										}

										newData[rowIndex] = {
											...newData[rowIndex],
											[column.key]: parsedValue,
										};
									});
								});

								return newData;
							});

							const colCount = Math.max(
								...rows.map((r) => r.split("\t").length),
							);
							const affectedCols = Math.min(
								colCount,
								CARGO_COLUMNS.length - startColumnIndex,
							);
							toast.success(
								`Đã dán ${rows.length} dòng × ${affectedCols} cột vào danh sách hàng`,
							);
						}
					}
				}
				// Single value paste - let input handle it normally
				return;
			}

			// Full row paste (when pasting outside input)
			const newItems: Partial<CargoListRow>[] = rows.map((rowText) => {
				const columns = rowText.split("\t");
				return {
					customCode: columns[0] || "",
					vietnameseName: columns[1] || "",
					hsCode: columns[2] || "",
					originalCountry: columns[3] || "",
					qty: normalizeLooseNumber(columns[4]),
					unit: columns[5] || "",
					qty2: normalizeLooseNumber(columns[6]),
					unit2: columns[7] || "",
					unitPrice: normalizeLooseNumber(columns[8]),
					totalPrice: normalizeLooseNumber(columns[9]),
					lineTaxableValue: normalizeLooseNumber(columns[10]),
					exportTaxRatePercent: normalizeLooseNumber(columns[11]),
					exportTaxAmount: normalizeLooseNumber(columns[12]),
					taxableUnitPrice: normalizeLooseNumber(columns[13]),
					imExDutyExemptionCode: columns[14] || "",
					imExDutyExemptionCondition: columns[15] || "",
					imExDutyExemptionAmount: normalizeLooseNumber(columns[16]),
					importTaxCode: columns[17] || "",
					importTaxRate: normalizeLooseNumber(columns[18]),
					importTaxAmount: normalizeLooseNumber(columns[19]),
					vatTaxCode: columns[20] || "",
					vatTaxRate: normalizeLooseNumber(columns[21]),
					vatTaxAmount: normalizeLooseNumber(columns[22]),
					dutyReductionCode: columns[23] || "",
					originalCargoName: columns[24] || "",
					followUpId: followUpId,
				};
			});

			if (newItems.length > 0) {
				setData((prev) => {
					if (prev.length === 1 && !hasEditableCargoValues(prev[0])) {
						return newItems;
					}

					return [...prev, ...newItems];
				});
				toast.success(`Đã dán ${newItems.length} dòng từ Excel`);
			}
		},
		[followUpId, createEmptyRow, readOnly, readOnlyReason],
	);

	// Add new empty row
	const addNewRow = useCallback(() => {
		if (readOnly) {
			toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
			return;
		}

		setData((prev) => [...prev, createEmptyRow()]);
	}, [createEmptyRow, readOnly, readOnlyReason]);

	// Delete a row (ensure at least one empty row remains)
	const deleteRow = useCallback(
		(rowIndex: number) => {
			if (readOnly) {
				toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
				return;
			}

			setData((prev) => {
				const newData = prev.filter((_, i) => i !== rowIndex);
				// If no rows left, add an empty one
				if (newData.length === 0) {
					return [createEmptyRow()];
				}
				return newData;
			});
		},
		[createEmptyRow, readOnly, readOnlyReason],
	);

	const handleExportExcel = () => {
		if (persistableRows.length === 0) {
			toast.error("Không có dữ liệu để xuất");
			return;
		}

		const headers = CARGO_COLUMNS.map((col) => col.label);
		const rows = persistableRows.map((item) =>
			CARGO_COLUMNS.map((col) => {
				const val = item[col.key as keyof typeof item];
				if (col.key === "invoiceDate") return formatDateVN(val as string);
				return val ?? "";
			}),
		);

		const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

		// Auto column widths
		worksheet["!cols"] = headers.map((h, i) => {
			const maxLen = Math.max(
				h.length,
				...rows.map((r) => String(r[i] ?? "").length),
			);
			return { wch: Math.min(maxLen + 2, 50) };
		});

		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Cargo List");
		XLSX.writeFile(workbook, `cargo-list-${followUpId}.xlsx`);
		toast.success("Xuất Excel thành công!");
	};

	const mergeImportedRows = useCallback((rows: Partial<CargoListRow>[]) => {
		if (rows.length === 0) {
			toast.error("File Excel không có dòng hàng hợp lệ để nhập");
			return;
		}

		setData((prev) => {
			if (prev.length === 1 && !hasEditableCargoValues(prev[0])) {
				return rows;
			}

			return [...prev, ...rows];
		});

		toast.success(`Đã nhập ${rows.length} dòng hàng từ file Excel`);
	}, []);

	const handleImportFile = useCallback(
		async (file: File) => {
			if (readOnly) {
				toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
				return;
			}

			setIsImporting(true);
			try {
				const buffer = await file.arrayBuffer();
				const workbook = XLSX.read(buffer, { type: "array" });
				const firstSheetName = workbook.SheetNames[0];
				const firstSheet = firstSheetName
					? workbook.Sheets[firstSheetName]
					: undefined;

				if (!firstSheet) {
					throw new Error("Không đọc được sheet đầu tiên trong file");
				}

				const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
					header: 1,
					raw: false,
					defval: "",
				});
				const importedRows = parseCargoRowsFromSheet(rawRows, followUpId);
				mergeImportedRows(importedRows);
			} catch (error) {
				console.error("Import cargo file error:", error);
				toast.error(
					error instanceof Error
						? error.message
						: "Không thể nhập dữ liệu từ file Excel",
				);
			} finally {
				setIsImporting(false);
			}
		},
		[followUpId, mergeImportedRows, readOnly, readOnlyReason],
	);

	const handleFileInputChange = useCallback(
		async (event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				await handleImportFile(file);
			}
			event.currentTarget.value = "";
		},
		[handleImportFile],
	);

	const handleDropFile = useCallback(
		async (event: React.DragEvent<HTMLElement>) => {
			event.preventDefault();
			setIsDragOver(false);

			const file = event.dataTransfer.files?.[0];
			if (!file) {
				return;
			}

			await handleImportFile(file);
		},
		[handleImportFile],
	);

	const saveRows = useCallback(
		async (options?: { quietSuccess?: boolean }) => {
			if (readOnly) {
				if (!options?.quietSuccess) {
					toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
				}
				return true;
			}

			if (isLoading) {
				return true;
			}

			if (loadError && data.length === 0) {
				toast.error(
					"Không thể lưu Cargo List vì chưa tải được dữ liệu hiện tại",
				);
				return false;
			}

			setIsSaving(true);
			try {
				const response = await fetch(`/api/followup/${followUpId}/cargo`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ items: persistableRows }),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.error || "Failed to save cargo list");
				}

				onDataChange?.(persistableRows);
				persistedSnapshotRef.current = JSON.stringify(persistableRows);
				setHasUnsavedChanges(false);
				if (!options?.quietSuccess) {
					toast.success("Đã lưu danh sách hàng");
				}
				await fetchCargoList();
				if (onRefresh) onRefresh();
				return true;
			} catch (error) {
				console.error("Save cargo error:", error);
				toast.error(
					error instanceof Error ? error.message : "Failed to save cargo list",
				);
				return false;
			} finally {
				setIsSaving(false);
			}
		},
		[
			data.length,
			fetchCargoList,
			followUpId,
			isLoading,
			loadError,
			onDataChange,
			onRefresh,
			persistableRows,
			readOnly,
			readOnlyReason,
		],
	);

	useImperativeHandle(
		ref,
		() => ({
			save: saveRows,
			getRows: () => persistableRows,
		}),
		[persistableRows, saveRows],
	);

	const handleSave = useCallback(async () => {
		if (readOnly) {
			toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
			return;
		}

		await saveRows();
	}, [readOnly, readOnlyReason, saveRows]);

	const clearData = async () => {
		if (readOnly) {
			toast.info(readOnlyReason ?? "Danh sách hàng đang ở chế độ chỉ xem.");
			return;
		}

		if (
			!confirm("Xóa toàn bộ dòng hàng? Thao tác này sẽ ghi đè dữ liệu hiện có.")
		) {
			return;
		}

		setIsClearing(true);
		try {
			const response = await fetch(`/api/followup/${followUpId}/cargo`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ items: [] }),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to clear cargo list");
			}

			setData([createEmptyRow()]); // Keep one empty row for new data entry
			persistedSnapshotRef.current = JSON.stringify([]);
			setHasUnsavedChanges(false);
			setShowOnlyIssueRows(false);
			onDataChange?.([]);
			toast.success("Đã xóa toàn bộ danh sách hàng");
			if (onRefresh) onRefresh();
		} catch (error) {
			console.error("Clear cargo error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to clear cargo list",
			);
		} finally {
			setIsClearing(false);
		}
	};

	// Render editable cell
	const renderEditableCell = (
		item: Partial<CargoListRow>,
		rowIndex: number,
		column: (typeof CARGO_COLUMNS)[number],
	) => {
		const value = item[column.key as keyof CargoListRow];
		const displayValue =
			column.key === "invoiceDate" ? formatDateVN(value as string) : value;
		const path = `cargoList[${rowIndex}].${column.key}`;
		const pathIssues = issuesByPath.get(path) ?? [];
		const issueSeverity = getHighestSeverity(pathIssues);
		const cargoUnitListId =
			isCargoUnitColumn(column.key) && cargoUnitOptions.length > 0
				? cargoUnitDatalistId
				: undefined;

		return (
			<Input
				type={column.type === "number" ? "number" : "text"}
				list={cargoUnitListId}
				value={displayValue ?? ""}
				onChange={(e) => handleCellChange(rowIndex, column.key, e.target.value)}
				disabled={readOnly}
				data-cargo-input="true"
				data-row-index={rowIndex}
				data-column-key={column.key}
				aria-invalid={issueSeverity === "error" ? true : undefined}
				title={pathIssues.map((issue) => issue.message).join("\n")}
				className={getIssueInputClassName(
					issueSeverity,
					cn(
						"w-full rounded-none",
						isCdsInfoVariant
							? "h-5 px-1 py-0 text-[10px] shadow-none focus-visible:ring-0"
							: "h-6 px-1 py-0 text-[11px]",
					),
				)}
				style={{
					width: getColumnWidth(column),
					minWidth: getColumnWidth(column),
				}}
			/>
		);
	};

	const renderMobileField = (
		item: Partial<CargoListRow>,
		rowIndex: number,
		column: CargoColumn,
	) => {
		const value = item[column.key as keyof CargoListRow];
		const displayValue =
			column.key === "invoiceDate" ? formatDateVN(value as string) : value;
		const path = `cargoList[${rowIndex}].${column.key}`;
		const pathIssues = issuesByPath.get(path) ?? [];
		const issueSeverity = getHighestSeverity(pathIssues);
		const cargoUnitListId =
			isCargoUnitColumn(column.key) && cargoUnitOptions.length > 0
				? cargoUnitDatalistId
				: undefined;

		return (
			<div
				key={`${rowIndex}-${column.key}`}
				className={cn(
					"flex flex-col gap-1",
					MOBILE_WIDE_FIELDS.has(column.key) && "min-[520px]:col-span-2",
				)}
			>
				<div className="text-[11px] font-medium text-slate-600">
					{column.label}
				</div>
				<Input
					type={column.type === "number" ? "number" : "text"}
					list={cargoUnitListId}
					value={displayValue ?? ""}
					onChange={(e) =>
						handleCellChange(rowIndex, column.key, e.target.value)
					}
					disabled={readOnly}
					data-cargo-input="true"
					data-row-index={rowIndex}
					data-column-key={column.key}
					aria-invalid={issueSeverity === "error" ? true : undefined}
					title={pathIssues.map((issue) => issue.message).join("\n")}
					className={getIssueInputClassName(
						issueSeverity,
						"h-8 rounded-md border-slate-200 bg-white px-2 text-xs shadow-none focus-visible:ring-0",
					)}
				/>
				{pathIssues[0] ? (
					<div className="text-[10px] leading-tight text-rose-700">
						{pathIssues[0].message}
					</div>
				) : null}
			</div>
		);
	};

	const getColumnWidth = useCallback(
		(column: CargoColumn) =>
			isCdsInfoVariant
				? (column.compactWidth ?? column.minWidth)
				: column.minWidth,
		[isCdsInfoVariant],
	);

	const desktopTableMinWidth = useMemo(() => {
		if (!shouldUseWideDesktopTable) {
			return null;
		}

		return (
			CARGO_COLUMNS.reduce(
				(sum, column) => sum + parsePixelWidth(getColumnWidth(column)),
				0,
			) + 64
		);
	}, [getColumnWidth, shouldUseWideDesktopTable]);

	return (
		<div
			className={cn(
				"flex min-w-0 flex-col",
				isCdsInfoVariant
					? "h-full min-h-0 gap-1.5 overflow-hidden p-1.5"
					: "gap-4 p-4",
			)}
		>
			{isCdsInfoVariant ? (
				<section className="shrink-0 min-w-0 rounded-none border border-[#b9b9b9] bg-white">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-[10.5px]">
						<div className="mr-auto flex min-w-0 items-center gap-1.5 text-slate-700">
							<FileSpreadsheet className="size-3 shrink-0" />
							<span className="font-semibold text-black">Danh sách hàng</span>
							<span className="hidden text-slate-500 xl:inline">
								`Ctrl+V` để dán nhanh hoặc nhập file Excel.
							</span>
						</div>
						<span className="text-slate-500">{visibleRowCountLabel}</span>
						<span className="text-slate-500">
							{persistableRows.length} dòng có dữ liệu
						</span>
						<span
							data-testid="cargo-save-status"
							className={cn(
								"font-medium",
								hasUnsavedChanges
									? "text-amber-700"
									: loadError
										? "text-rose-700"
										: "text-emerald-700",
							)}
						>
							{saveStatusLabel}
						</span>
						<span
							className={cn(
								"font-medium",
								blockingIssues.length > 0
									? "text-rose-700"
									: allIssues.length > 0
										? "text-amber-700"
										: "text-emerald-700",
							)}
						>
							{blockingIssues.length > 0
								? `${blockingIssues.length} lỗi cần sửa khi gửi`
								: allIssues.length > 0
									? `${allIssues.length} cần rà soát`
									: "Sẵn sàng lưu nháp"}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={addNewRow}
							disabled={readOnly}
							className="h-6 rounded-none px-2 text-[10.5px]"
						>
							<Plus data-icon="inline-start" />
							Thêm dòng
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={isImporting || readOnly}
							className="h-6 rounded-none px-2 text-[10.5px]"
						>
							{isImporting ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Upload data-icon="inline-start" />
							)}
							{isImporting ? "Đang nhập..." : "Nhập Excel/CSV"}
						</Button>
						{data.length > 0 ? (
							<Button
								variant="outline"
								size="sm"
								onClick={clearData}
								disabled={isClearing || readOnly}
								className="h-6 rounded-none px-2 text-[10.5px]"
							>
								{isClearing ? (
									<Spinner data-icon="inline-start" />
								) : (
									<Trash2 data-icon="inline-start" />
								)}
								Xóa hết
							</Button>
						) : null}
						<Button
							size="sm"
							onClick={handleSave}
							disabled={isSaving || readOnly}
							className="h-6 rounded-none px-2 text-[10.5px]"
						>
							{isSaving ? (
								<Spinner data-icon="inline-start" />
							) : (
								<Save data-icon="inline-start" />
							)}
							{isSaving ? "Đang lưu..." : "Lưu"}
						</Button>
					</div>
					<div className="min-w-0 border-t border-[#d8d8d8] px-2 py-1.5">
						<div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
							<div className="relative min-w-0 flex-1 sm:max-w-[380px]">
								<Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
								<Input
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									placeholder="Tìm theo mã hàng, HS, tên hàng..."
									className="h-7 rounded-none border-[#c5c5c5] pl-7 pr-2 text-[10.5px] shadow-none focus-visible:ring-0"
								/>
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-1 self-start sm:self-auto">
								{issueRowIndexes.size > 0 || showOnlyIssueRows ? (
									<Button
										variant={showOnlyIssueRows ? "default" : "outline"}
										size="sm"
										onClick={() => setShowOnlyIssueRows((prev) => !prev)}
										className="h-6 rounded-none px-2 text-[10.5px]"
									>
										{showOnlyIssueRows
											? "Hiện tất cả"
											: `Chỉ lỗi (${issueRowIndexes.size})`}
									</Button>
								) : null}
								{normalizedSearchQuery || showOnlyIssueRows ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={clearActiveFilters}
										className="h-6 rounded-none px-2 text-[10.5px]"
									>
										Xóa lọc
									</Button>
								) : null}
								<Button
									variant={
										preferredCdsLayout === "cards" ? "default" : "outline"
									}
									size="sm"
									onClick={() => setPreferredCdsLayout("cards")}
									className="h-6 rounded-none px-2 text-[10.5px]"
								>
									Thẻ
								</Button>
								<Button
									variant={
										preferredCdsLayout === "table" ? "default" : "outline"
									}
									size="sm"
									onClick={() => setPreferredCdsLayout("table")}
									className="h-6 rounded-none px-2 text-[10.5px]"
								>
									Bảng
								</Button>
							</div>
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
							<span>
								Chọn một ô rồi dán từ Excel để cập nhật nhiều dòng và nhiều cột.
							</span>
							<span>Dùng nút Nhập Excel/CSV để nạp file hàng loạt.</span>
						</div>
					</div>
				</section>
			) : (
				<section className="rounded-lg border bg-background shadow-xs">
					<div className="flex flex-col gap-4 px-4 py-4">
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="flex min-w-0 flex-col gap-2">
								<div className="flex items-center gap-2 text-sm font-medium text-foreground">
									<FileSpreadsheet className="shrink-0" />
									<span>Danh sách hàng</span>
								</div>
								<p className="text-xs text-muted-foreground">
									Chỉnh trực tiếp trên bảng, dán từ Excel hoặc nhập file để cập
									nhật nhanh danh sách hàng.
								</p>
							</div>

							<div className="flex flex-wrap gap-2">
								<Badge variant="outline">{visibleRowCountLabel}</Badge>
								<Badge
									variant={persistableRows.length > 0 ? "secondary" : "outline"}
								>
									{persistableRows.length} dòng có dữ liệu
								</Badge>
								<Badge
									variant={
										blockingIssues.length > 0
											? "destructive"
											: allIssues.length > 0
												? "warning"
												: "success"
									}
								>
									{blockingIssues.length > 0
										? `${blockingIssues.length} lỗi cần sửa khi gửi`
										: allIssues.length > 0
											? `${allIssues.length} cần rà soát`
											: "Sẵn sàng lưu nháp"}
								</Badge>
							</div>
						</div>

						<Separator />

						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div className="relative min-w-0 flex-1 sm:max-w-md">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
								<Input
									value={searchQuery}
									onChange={(event) => setSearchQuery(event.target.value)}
									placeholder="Tìm theo mã hàng, HS, tên hàng..."
									className="pl-9"
								/>
							</div>
							{normalizedSearchQuery ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSearchQuery("")}
									className="self-start sm:self-auto"
								>
									Xóa lọc
								</Button>
							) : null}
						</div>

						<div className="flex w-full flex-wrap items-stretch gap-2 sm:items-center">
							<Button
								variant="outline"
								size="sm"
								onClick={fetchCargoList}
								disabled={isSaving || isClearing || isLoading}
								className="flex-1 sm:flex-none"
							>
								<RefreshCw data-icon="inline-start" />
								Tải lại
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={addNewRow}
								disabled={readOnly}
								className="flex-1 sm:flex-none"
							>
								<Plus data-icon="inline-start" />
								Thêm dòng
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => fileInputRef.current?.click()}
								disabled={isImporting || readOnly}
								className="flex-1 sm:flex-none"
							>
								{isImporting ? (
									<Spinner data-icon="inline-start" />
								) : (
									<Upload data-icon="inline-start" />
								)}
								{isImporting ? "Đang nhập..." : "Nhập Excel/CSV"}
							</Button>
							{data.length > 0 && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleExportExcel}
									className="flex-1 sm:flex-none"
								>
									<Download data-icon="inline-start" />
									Xuất Excel
								</Button>
							)}
							{data.length > 0 && (
								<Button
									variant="outline"
									size="sm"
									onClick={clearData}
									disabled={isClearing || readOnly}
									className="flex-1 sm:flex-none"
								>
									{isClearing ? (
										<Spinner data-icon="inline-start" />
									) : (
										<Trash2 data-icon="inline-start" />
									)}
									Xóa hết
								</Button>
							)}
							<Button
								size="sm"
								onClick={handleSave}
								disabled={isSaving || readOnly}
								className="flex-1 sm:flex-none"
							>
								{isSaving ? (
									<Spinner data-icon="inline-start" />
								) : (
									<Save data-icon="inline-start" />
								)}
								{isSaving ? "Đang lưu..." : "Lưu"}
							</Button>
						</div>
					</div>
				</section>
			)}

			{allIssues.length > 0 && (
				<div
					className={cn(
						"rounded-lg border bg-background px-3 py-2.5 shrink-0",
						isCdsInfoVariant ? "text-[11px]" : "text-xs",
					)}
				>
					<div className="flex flex-wrap items-center gap-2">
						<AlertTriangle className="text-muted-foreground" />
						<span className="font-medium text-foreground">
							{blockingIssues.length > 0
								? `Danh sách hàng đang có ${blockingIssues.length} lỗi và ${allIssues.length - blockingIssues.length} cảnh báo. Vẫn lưu nháp được; cần sửa trước khi gửi/đăng ký.`
								: `Danh sách hàng đang có ${allIssues.length} cảnh báo cần rà soát trước khi gửi/đăng ký.`}
						</span>
					</div>
				</div>
			)}

			{!isCdsInfoVariant ? (
				<label
					className={cn(
						"rounded-lg border border-dashed px-4 py-4 text-sm transition-colors",
						isDragOver
							? "border-sky-400 bg-sky-50 text-sky-800"
							: "border-slate-300 bg-white text-slate-700",
					)}
					htmlFor={`cargo-import-${followUpId}`}
					aria-label="Kéo thả hoặc chọn file Excel để nhập danh sách hàng"
					onDragOver={(event) => {
						event.preventDefault();
						setIsDragOver(true);
					}}
					onDragLeave={(event) => {
						event.preventDefault();
						setIsDragOver(false);
					}}
					onDrop={(event) => void handleDropFile(event)}
				>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<div className="font-medium">
								Kéo thả file Excel/CSV vào đây để nhập nhanh danh sách hàng
							</div>
							<div className="text-xs text-slate-500">
								Hoặc copy từ Excel rồi dán trực tiếp bằng{" "}
								<kbd className="rounded bg-slate-100 px-1">Ctrl+V</kbd>.
							</div>
						</div>
						<span
							className={cn(
								"inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs",
								isImporting ? "opacity-70" : "cursor-pointer hover:bg-accent",
							)}
						>
							{isImporting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<FileSpreadsheet className="size-4" />
							)}
							<span>{isImporting ? "Đang nhập..." : "Chọn file"}</span>
						</span>
					</div>
				</label>
			) : null}

			<input
				id={`cargo-import-${followUpId}`}
				ref={fileInputRef}
				type="file"
				accept=".xlsx,.xls,.csv"
				className="hidden"
				disabled={readOnly}
				onChange={(event) => void handleFileInputChange(event)}
			/>

			{isCdsInfoVariant && cargoUnitOptions.length > 0 ? (
				<datalist id={cargoUnitDatalistId}>
					{cargoUnitOptions.map((option) => (
						<option
							key={option.code}
							value={option.code}
							label={getCargoUnitOptionLabel(option)}
						/>
					))}
				</datalist>
			) : null}

			<div
				className={cn(
					"flex min-w-0 flex-col gap-3",
					isCdsInfoVariant && "min-h-0 flex-1 overflow-hidden",
				)}
			>
				<div
					data-testid="cargo-mobile-cards"
					ref={mobileCardsRef}
					onPaste={handlePaste}
					className={cn(
						"flex flex-col gap-3",
						isCdsInfoVariant
							? showMobileCards
								? "min-h-0 flex-1 overflow-auto"
								: "hidden"
							: "sm:hidden",
					)}
				>
					{isLoading ? (
						<div className="rounded-lg border bg-background px-4 py-4">
							<div className="flex flex-col gap-3">
								<Skeleton className="h-5 w-40" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-4/5" />
							</div>
						</div>
					) : loadError ? (
						<div className="rounded-lg border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
							<div className="flex flex-col items-center gap-3">
								<span className="text-destructive">{loadError}</span>
								<Button variant="outline" size="sm" onClick={fetchCargoList}>
									<RefreshCw data-icon="inline-start" /> Thử lại
								</Button>
							</div>
						</div>
					) : showFilteredEmptyState ? (
						<div className="rounded-lg border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
							<div className="flex flex-col items-center gap-3">
								<span>{emptyStateMessage}</span>
								<Button
									variant="outline"
									size="sm"
									onClick={clearActiveFilters}
								>
									Xóa bộ lọc
								</Button>
							</div>
						</div>
					) : (
						visibleRows.map(({ item, index }) => {
							const issueCount = rowIssueCounts.get(index);
							const summaryBadges = getCargoRowSummaryBadges(item);

							return (
								<div
									key={`mobile-${index}-${followUpId}`}
									className="rounded-lg border bg-background p-3 shadow-xs"
								>
									<div className="mb-3 flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="text-sm font-medium text-slate-800">
												Dòng hàng {index + 1}
											</div>
											<div className="mt-1 text-xs text-slate-500">
												{getCargoRowTitle(item)}
											</div>
											{summaryBadges.length > 0 ? (
												<div className="mt-2 flex flex-wrap items-center gap-1">
													{summaryBadges.map((summary) => (
														<Badge
															key={`${index}-${summary}`}
															variant="outline"
															className="px-1.5 py-0 text-[10px] text-slate-600"
														>
															{summary}
														</Badge>
													))}
												</div>
											) : null}
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{issueCount?.total ? (
												<Badge
													variant={getIssueBadgeVariant(issueCount)}
													className="px-2 py-0.5 text-[10px]"
												>
													{issueCount.total}
												</Badge>
											) : null}
											<Button
												variant="ghost"
												size="icon"
												onClick={() => deleteRow(index)}
												disabled={readOnly}
												className="size-8"
												aria-label={`Xóa dòng hàng ${index + 1}`}
											>
												<X />
											</Button>
										</div>
									</div>

									<div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2">
										{CARGO_COLUMNS.map((column) =>
											renderMobileField(item, index, column),
										)}
									</div>
								</div>
							);
						})
					)}
				</div>

				<div
					data-testid="cargo-desktop-table"
					ref={desktopTableScrollRef}
					className={cn(
						"w-full min-w-0 max-w-full focus:outline-none",
						isCdsInfoVariant
							? showDesktopTable
								? "cds-visible-scrollbar block min-h-[80px] flex-1 overflow-auto rounded-none border border-[#b9b9b9] bg-white"
								: "hidden"
							: "hidden min-h-[300px] rounded-lg border bg-background shadow-xs focus:ring-1 focus:ring-primary/20 sm:block",
					)}
					onPaste={handlePaste}
				>
					<Table
						className={
							shouldUseWideDesktopTable ? "!w-max min-w-full" : undefined
						}
						style={
							shouldUseWideDesktopTable
								? {
										borderCollapse: "collapse",
										tableLayout: "fixed",
										width: "max-content",
										minWidth: `${desktopTableMinWidth ?? 0}px`,
									}
								: isCdsInfoVariant
									? {
											borderCollapse: "collapse",
											tableLayout: "fixed",
											width: "max-content",
											minWidth: "100%",
										}
									: undefined
						}
					>
						<TableHeader
							className={cn(isCdsInfoVariant ? "bg-muted/50" : "bg-muted/70")}
						>
							<TableRow>
								<TableHead
									className={cn(
										"whitespace-nowrap",
										isCdsInfoVariant
											? "sticky top-0 z-10 h-7 w-6 border-b border-slate-300 bg-slate-100 px-1 text-[9px] font-normal text-slate-500"
											: "h-8 w-8 text-[10px]",
									)}
								>
									{isCdsInfoVariant ? "*" : "#"}
								</TableHead>
								{CARGO_COLUMNS.map((col) => (
									<TableHead
										key={col.key}
										className={cn(
											"whitespace-nowrap font-normal",
											isCdsInfoVariant
												? "sticky top-0 z-10 h-7 border-r border-b border-slate-300 bg-slate-100 px-1 text-[9px] text-slate-700"
												: "h-8 text-[10px]",
										)}
										style={{
											width: getColumnWidth(col),
											minWidth: getColumnWidth(col),
										}}
										title={col.label}
									>
										{col.label}
									</TableHead>
								))}
								<TableHead
									className={cn(
										"whitespace-nowrap",
										isCdsInfoVariant
											? "sticky top-0 z-10 h-7 w-6 border-b border-slate-300 bg-slate-100 px-1"
											: "h-8 w-8 text-[10px]",
									)}
								></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={CARGO_COLUMNS.length + 2}
										className="h-32 text-center text-muted-foreground"
									>
										<div className="flex flex-col items-center gap-3">
											<Spinner className="size-5" />
											<span>Đang tải danh sách hàng...</span>
										</div>
									</TableCell>
								</TableRow>
							) : loadError ? (
								<TableRow>
									<TableCell
										colSpan={CARGO_COLUMNS.length + 2}
										className="h-32 text-center text-muted-foreground"
									>
										<div className="flex flex-col items-center gap-3">
											<span className="text-destructive">{loadError}</span>
											<Button
												variant="outline"
												size="sm"
												onClick={fetchCargoList}
											>
												<RefreshCw data-icon="inline-start" /> Thử lại
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : showFilteredEmptyState ? (
								<TableRow>
									<TableCell
										colSpan={CARGO_COLUMNS.length + 2}
										className="h-32 text-center text-muted-foreground"
									>
										<div className="flex flex-col items-center gap-3">
											<span>{emptyStateMessage}</span>
											<Button
												variant="outline"
												size="sm"
												onClick={clearActiveFilters}
											>
												Xóa bộ lọc
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : (
								visibleRows.map(({ item, index }) => (
									<TableRow
										key={`${index}-${followUpId}`}
										className={cn(
											"hover:bg-slate-100/50",
											isCdsInfoVariant &&
												"h-7 border-b border-slate-200 even:bg-slate-50/35",
										)}
									>
										<TableCell
											className={cn(
												"text-muted-foreground",
												isCdsInfoVariant
													? "w-6 border-r border-slate-300 bg-slate-50 px-1 py-0.5 text-center text-[9px]"
													: "w-8 px-2 py-0.5 text-[10px]",
											)}
										>
											<div className="flex flex-col items-center leading-none gap-1">
												<span>{index + 1}</span>
												{rowIssueCounts.get(index)?.total ? (
													<Badge
														variant={getIssueBadgeVariant(
															rowIssueCounts.get(index),
														)}
														className="px-1.5 py-0.5 text-[9px]"
													>
														{rowIssueCounts.get(index)?.total}
													</Badge>
												) : null}
											</div>
										</TableCell>
										{CARGO_COLUMNS.map((col) => (
											<TableCell
												key={col.key}
												className={cn(
													isCdsInfoVariant
														? "border-r border-slate-200 px-0 py-0"
														: "px-1 py-0.5",
												)}
												style={{
													width: getColumnWidth(col),
													minWidth: getColumnWidth(col),
												}}
											>
												{renderEditableCell(item, index, col)}
											</TableCell>
										))}
										<TableCell
											className={cn(
												isCdsInfoVariant
													? "w-6 bg-slate-50 px-0 py-0"
													: "w-8 px-1 py-0.5",
											)}
										>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => deleteRow(index)}
												disabled={readOnly}
												className={cn(isCdsInfoVariant ? "size-5" : "size-6")}
											>
												<X />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{allIssues.length > 0 && (
				<div
					className={cn(
						"rounded-lg border bg-background px-3 py-3",
						isCdsInfoVariant && "max-h-36 shrink-0 overflow-y-auto",
					)}
				>
					<div className="flex flex-col gap-2">
						<div className="text-xs font-medium text-slate-700">
							Danh sách điểm cần kiểm tra
						</div>
						<Separator />
					</div>
					<div className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
						{allIssues.slice(0, MAX_VISIBLE_ISSUES).map((issue, index) => {
							const { rowIndex, columnKey } = getCargoIssueMeta(issue.path);
							const label =
								rowIndex === null
									? issue.path
									: `Dòng ${rowIndex + 1}${columnKey ? ` / ${CARGO_COLUMN_LABELS[columnKey]}` : ""}`;
							const canFocusIssue = rowIndex !== null && columnKey !== null;

							return (
								<button
									type="button"
									key={`${issue.path}-${issue.message}-${index}`}
									className={cn(
										"flex w-full flex-wrap items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
										canFocusIssue
											? "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
											: "cursor-default",
									)}
									onClick={() => focusIssueField(rowIndex, columnKey)}
									disabled={!canFocusIssue}
								>
									<Badge
										variant={
											issue.severity === "error"
												? "destructive"
												: issue.severity === "warning"
													? "warning"
													: "info"
										}
										className="px-1.5 py-0.5 text-[10px]"
									>
										{issue.severity.toUpperCase()}
									</Badge>
									<span className="font-medium text-slate-700">{label}:</span>{" "}
									<span>{issue.message}</span>
									{issue.suggestions && issue.suggestions.length > 0
										? ` Gợi ý: ${issue.suggestions.join(", ")}`
										: ""}
									{canFocusIssue ? (
										<span className="ml-auto text-[10px] font-medium text-sky-700">
											Đi tới ô
										</span>
									) : null}
								</button>
							);
						})}
						{allIssues.length > MAX_VISIBLE_ISSUES && (
							<div className="text-muted-foreground">
								Còn {allIssues.length - MAX_VISIBLE_ISSUES} cảnh báo khác trong
								bảng.
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
});

CargoListPanelInner.displayName = "CargoListPanel";

export const CargoListPanelWithRef = CargoListPanelInner;

export function CargoListPanel(props: CargoListPanelProps) {
	return <CargoListPanelInner {...props} />;
}

CargoListPanel.displayName = "CargoListPanel";
