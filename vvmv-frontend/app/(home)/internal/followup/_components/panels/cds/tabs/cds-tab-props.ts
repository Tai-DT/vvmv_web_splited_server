import type { ReactNode } from "react";
import type { FollowUpCdsInfoRow } from "../../../../types";
import type { CdsCollectionTablesProps } from "../cds-collection-tables";
import type { FieldRenderLockOptions } from "../cds-lookup-types";

export interface CdsTabRenderProps {
	data: Partial<FollowUpCdsInfoRow>;
	handleFieldChange: (field: keyof FollowUpCdsInfoRow, value: unknown) => void;
	suppressManualScrollRestore: (applyChange: () => void) => void;
	renderClassicLabel: (label: string, required?: boolean) => ReactNode;
	renderClassicSectionHeader: (title: string) => ReactNode;
	renderClassicDateInput: (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
	) => ReactNode;
	renderClassicSelect: (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
		lockOptions?: FieldRenderLockOptions,
	) => ReactNode;
	renderClassicInput: (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
		placeholder?: string,
		lockOptions?: FieldRenderLockOptions,
	) => ReactNode;
	renderClassicReadonlyInput: (
		value: string | null | undefined,
		className?: string,
	) => ReactNode;
	renderClassicCodeLookupSelect: (
		fieldKey: keyof FollowUpCdsInfoRow,
		options?: {
			codeWidthClassName?: string;
			selectClassName?: string;
			wrapperClassName?: string;
			showButton?: boolean;
			lockOptions?: FieldRenderLockOptions;
		},
	) => ReactNode;
	renderLookupCodeAndName: (
		fieldKey: keyof FollowUpCdsInfoRow,
		displayField?: keyof FollowUpCdsInfoRow,
		options?: {
			codeWidthClassName?: string;
			buttonLabel?: string;
			hideButton?: boolean;
			namePlaceholder?: string;
		},
	) => ReactNode;
	renderLookupPickerButton: (
		fieldKey: keyof FollowUpCdsInfoRow,
		options?: {
			buttonLabel?: string;
			className?: string;
			displayField?: keyof FollowUpCdsInfoRow;
			lockOptions?: FieldRenderLockOptions;
		},
	) => ReactNode;
	renderInfoButton: (
		message: string,
		options?: {
			buttonLabel?: string;
			className?: string;
			icon?: ReactNode;
			ariaLabel?: string;
		},
	) => ReactNode;
	renderExportSectionHeader: (title: string) => ReactNode;
	getImportImage1FieldLockOptions: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => FieldRenderLockOptions | undefined;
	getExportFieldLockOptions: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => FieldRenderLockOptions | undefined;
	resolvedGetLookupDescription: (fieldKey: keyof FollowUpCdsInfoRow) => string;
	valuationAllocationRatioTotal: string;
	commonTableProps: CdsCollectionTablesProps;
}
