import { toast } from "sonner";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api/client";

/**
 * Configuration for column transformations during export
 */
export interface ColumnTransformConfig {
	/**
	 * Dependency key to resolve ID to name (e.g., 'serviceModes', 'units')
	 */
	useDependency?: string;
	/**
	 * Custom transformation function for the column value
	 */
	transform?: (value: any, row: any, dependencies?: any) => any;
}

/**
 * Configuration for export headers and transformations
 */
export interface ExportHeaderConfig {
	header: string;
	cellProps?: {
		useDependency?: string;
	};
	transform?: (value: any, row: any, dependencies?: any) => any;
}

/**
 * Configuration for Excel export
 */
export interface ExcelExportConfig<T = any> {
	/**
	 * API endpoint to fetch data from
	 */
	apiUrl: string;

	/**
	 * Name of the Excel sheet
	 */
	sheetName: string;

	/**
	 * Base filename (without extension)
	 */
	filename: string;

	/**
	 * Mapping of column IDs to header configurations
	 */
	headerConfigs?: Record<string, ExportHeaderConfig | string>;

	/**
	 * Dependencies for resolving IDs to names
	 */
	dependencies?: Record<string, any[]>;

	/**
	 * Column IDs to exclude from export
	 */
	excludeColumns?: string[];

	/**
	 * Function to get visible columns (e.g., from TanStack Table)
	 */
	getVisibleColumns?: () => Array<{ id: string }>;

	/**
	 * Custom data transformation function
	 */
	transformRow?: (row: T, visibleColumns: string[]) => Record<string, any>;

	/**
	 * Additional columns to add to each row (not from table columns)
	 */
	additionalColumns?: (row: T) => Record<string, any>;

	/**
	 * Filter parameters to pass to API
	 */
	filters?: {
		search?: string;
		status?: string;
		hideOthers?: boolean;
		advanced?: any[];
		sorting?: any[];
		dateRange?: { from?: string; to?: string };
		serviceModeTypes?: string;
	};

	/**
	 * Format for filename timestamp
	 * - 'date': YYYY-MM-DD (default)
	 * - 'datetime': YYYYMMDDTHHmmss
	 */
	filenameTimestampFormat?: "date" | "datetime";

	/**
	 * Success toast duration in ms (default: 4000)
	 */
	successToastDuration?: number;

	/**
	 * Error toast duration in ms (default: Infinity)
	 */
	errorToastDuration?: number | typeof Infinity;
}

/**
 * Formats a date value to Vietnamese locale
 */
function formatDateValue(value: any): string {
	if (!value) return "";

	try {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) {
			return date.toLocaleDateString("vi-VN");
		}
	} catch {
		// ignore
	}

	return value;
}

/**
 * Resolves a value using dependencies (ID to name)
 */
function resolveDependency(
	value: any,
	dependencyKey: string,
	dependencies?: Record<string, any[]>,
): any {
	if (!dependencies || !dependencies[dependencyKey]) return value;

	const deps = dependencies[dependencyKey];
	if (!Array.isArray(deps)) return value;

	const option = deps.find((opt: any) => (opt.id || opt.value) === value);
	return option ? option.name || option.label || value : value;
}

/**
 * Generic Excel export utility
 */
export async function exportToExcel<T = any>(
	config: ExcelExportConfig<T>,
): Promise<void> {
	const exportToast = toast.loading("Preparing export data...");

	try {
		// Build API URL with filters
		const params = new URLSearchParams();
		params.append("page", "1");
		params.append("pageSize", "100000"); // Fetch all matching records

		const filters = config.filters;
		if (filters?.search) params.append("search", filters.search);
		if (filters?.status && filters.status !== "all")
			params.append("status", filters.status);
		if (filters?.hideOthers) params.append("hideOthers", "true");
		if (filters?.advanced && filters.advanced.length > 0)
			params.append("filters", JSON.stringify(filters.advanced));
		if (filters?.sorting && filters.sorting.length > 0)
			params.append("sorting", JSON.stringify(filters.sorting));
		if (filters?.dateRange?.from) params.append("from", filters.dateRange.from);
		if (filters?.dateRange?.to) params.append("to", filters.dateRange.to);
		if (filters?.serviceModeTypes)
			params.append("serviceModeTypes", filters.serviceModeTypes);

		const apiUrl = `${config.apiUrl}?${params.toString()}`;
		const response = await apiFetch(apiUrl);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API Error: ${response.status} - ${errorText}`);
		}

		const result = await response.json();
		const allRows = Array.isArray(result)
			? result
			: result.data || result.rows || [];

		if (!allRows.length) {
			toast.info("No records found matching current filters", {
				id: exportToast,
			});
			return;
		}

		// Get visible columns
		let visibleColumnIds: string[] = [];
		if (config.getVisibleColumns) {
			visibleColumnIds = config
				.getVisibleColumns()
				.map((col) => col.id)
				.filter((id) => !config.excludeColumns?.includes(id));
		} else {
			// Fallback: get all columns from first row
			visibleColumnIds = Object.keys(allRows[0]).filter(
				(id) => !config.excludeColumns?.includes(id),
			);
		}

		// Transform data for export
		const exportData = allRows.map((original: T) => {
			// Use custom transform if provided
			if (config.transformRow) {
				return config.transformRow(original, visibleColumnIds);
			}

			// Default transformation
			const rowData: Record<string, any> = {};

			for (const colId of visibleColumnIds) {
				const headerConfig = config.headerConfigs?.[colId];
				const header =
					typeof headerConfig === "string"
						? headerConfig
						: (headerConfig as ExportHeaderConfig)?.header || colId;

				let value = (original as any)[colId];

				// Apply custom transform if provided
				if (
					typeof headerConfig === "object" &&
					(headerConfig as ExportHeaderConfig).transform
				) {
					value = (headerConfig as ExportHeaderConfig).transform?.(
						value,
						original,
						config.dependencies,
					);
				}
				// Resolve dependency
				else if (
					typeof headerConfig === "object" &&
					(headerConfig as ExportHeaderConfig).cellProps?.useDependency
				) {
					const depKey = (headerConfig as ExportHeaderConfig).cellProps
						?.useDependency;
					if (depKey) {
						value = resolveDependency(value, depKey, config.dependencies);
					}
				}

				// Auto-format dates
				if (
					value &&
					typeof value === "string" &&
					(colId.toLowerCase().includes("date") ||
						colId.toLowerCase().includes("time") ||
						colId === "etaEtd")
				) {
					value = formatDateValue(value);
				} else if (value instanceof Date) {
					value = formatDateValue(value);
				} else if (value === null || value === undefined) {
					value = "";
				}

				rowData[header] = value;
			}

			// Add additional columns if provided
			if (config.additionalColumns) {
				const additionalCols = config.additionalColumns(original);
				Object.assign(rowData, additionalCols);
			}

			return rowData;
		});

		// Create workbook and worksheet
		const worksheet = XLSX.utils.json_to_sheet(exportData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);

		// Generate filename with timestamp
		let timestamp: string;
		if (config.filenameTimestampFormat === "datetime") {
			const now = new Date();
			timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, "");
		} else {
			timestamp = new Date().toISOString().split("T")[0];
		}
		const filename = `${config.filename}_${timestamp}.xlsx`;

		// Download file
		XLSX.writeFile(workbook, filename);

		toast.success("Exported successfully", {
			id: exportToast,
			description: `${allRows.length} rows exported to ${filename}`,
			duration: config.successToastDuration || 4000,
		});
	} catch (error) {
		console.error("Export failed:", error);
		toast.error(
			`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			{
				id: exportToast,
				duration: config.errorToastDuration ?? Number.POSITIVE_INFINITY,
			},
		);
	}
}
