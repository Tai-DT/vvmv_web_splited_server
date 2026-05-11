/**
 * Shared column configuration type for data tables.
 *
 * This interface defines the metadata structure for table columns,
 * including display properties, sizing, and capabilities (resizing, pinning, etc.).
 *
 * Used by both Logistics and Trucking tables to ensure consistent column behavior.
 */
export interface ColumnConfig {
	/** Display name for the column header */
	header: string;

	/** Custom cell component for rendering cell content */
	cell?: React.ComponentType<any>;

	/** Props to pass to the cell component */
	cellProps?: Record<string, any>;

	/** Default column width in pixels */
	size?: number;

	/** Minimum column width in pixels */
	minSize?: number;

	/** Maximum column width in pixels */
	maxSize?: number;

	/** Whether the column can be resized by the user */
	enableResizing?: boolean;

	/** Whether the column can be pinned left/right */
	enablePinning?: boolean;

	/** Whether the column can be hidden via column management */
	enableHiding?: boolean;

	/** Whether the column supports sorting */
	enableSorting?: boolean;

	/** Custom sorting function name (e.g., "alphanumeric", "datetime") */
	sortingFn?: string;

	/** Custom filter function name (e.g., "includesString", "fuzzy") */
	filterFn?: string;

	/** Whether the column is hidden by default */
	hidden?: boolean;

	/**
	 * Whether the column is permanently pinned and cannot be unpinned.
	 * Used for system columns like "actions" that must always stay in place.
	 */
	isPermanentlyPinned?: boolean;
}
