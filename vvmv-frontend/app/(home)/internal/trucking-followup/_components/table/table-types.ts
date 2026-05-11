import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
	interface TableMeta<TData extends RowData> {
		updateData?: (rowId: string, columnId: string, value: unknown) => void;
		onSubTabClick?: (rowId: string, tab: any) => void;
		onViewDetails?: (rowData: any) => void;
		onDeleteTransaction?: (rowData: any) => void;
		activeRowTabs?: Record<string, string>;
		onComposeMail?: (
			drafts: Array<{
				vendorName?: string;
				to: string;
				cc?: string;
				subject: string;
				replyThread?: {
					threadId: string;
					inReplyTo?: string;
					references?: string;
				};
				bodyPrefix: string;
				driveUrl: string;
				driveFiles: Array<{
					id: string;
					name: string;
					webViewLink?: string;
					mimeType: string;
				}>;
				userEmail: string;
			}>,
		) => void;
		onOpenContainerInfoMail?: (rowData: any) => void;
	}
}
