"use client";

import { EditableCell } from "../../../followup/_components/cells/editable-cell";
import { TruckingDiffCellWrapper } from "./trucking-diff-cell-wrapper";

export function TruckingDiffEditableCell(props: any) {
	return (
		<TruckingDiffCellWrapper props={props}>
			<EditableCell {...props} />
		</TruckingDiffCellWrapper>
	);
}
