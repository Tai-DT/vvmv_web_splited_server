import type { RowData } from "@tanstack/react-table";
import type {
	CerOfOrigin,
	Container,
	Declaration,
	FollowUp,
	Invoker,
} from "@/prisma/client";

// Keys that are actual Prisma model fields
export type FollowUpKey = keyof FollowUp;
export type DeclarationKey = keyof Declaration;
export type ContainerKey = keyof Container;
export type InvokerKey = keyof Invoker;
export type CerOfOriginKey = keyof CerOfOrigin;

// Virtual/computed columns not in Prisma models
export type VirtualColumn = "actions" | "status" | "documents";

// All possible column keys
export type ColumnKey =
	| FollowUpKey
	| `declaration_${DeclarationKey}`
	| `container_${ContainerKey}`
	| `invoker_${InvokerKey}`
	| VirtualColumn;

// Re-export ColumnConfig from shared location for backward compatibility
export type { ColumnConfig } from "@/components/shared/data-table/types/column-config";

// Type safety for TanStack Table Meta
declare module "@tanstack/react-table" {
	interface TableMeta<TData extends RowData> {
		dependencies?: Record<string, any>;
		updateData?: (rowId: string, columnId: string, value: unknown) => void;
		onSubTabClick?: (rowId: string, tab: any) => void;
		onRerunTransaction?: (rowData: any) => void;
		onCreateContainer?: (rowData: any) => void;
		onDeleteTransation?: (rowData: any) => void;
		onViewDetails?: (rowData: any) => void;
		refreshData?: () => void;
		onBulkAction?: (action: string) => Promise<void>;
	}
}
