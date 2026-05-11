// cds-utils.ts – extracted utilities from cds-info-panel.tsx

import type React from "react";

import {
	FOLLOWUP_CDS_INFO_SECTION_CONFIGS,
	FOLLOWUP_CDS_SECTION_COLORS,
} from "../panel-config";
import type { CompositeFieldRef, FieldConfig } from "./cds-types";

// Equality helpers
export function areStringArraysEqual(left: string[], right: string[]): boolean {
	if (left === right) return true;
	if (left.length !== right.length) return false;
	for (let i = 0; i < left.length; i++) {
		if (left[i] !== right[i]) return false;
	}
	return true;
}

export function areShallowRecordsEqual(
	left: Record<string, unknown>,
	right: Record<string, unknown>,
): boolean {
	if (left === right) return true;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const key of leftKeys) {
		if (!Object.is(left[key], right[key])) return false;
	}
	return true;
}

// Section lookup maps
export const CDS_SECTION_BY_TITLE = new Map(
	FOLLOWUP_CDS_INFO_SECTION_CONFIGS.map((section) => [section.title, section]),
);

export const CDS_COLOR_BY_TITLE = new Map<
	string,
	(typeof FOLLOWUP_CDS_SECTION_COLORS)[number]
>([
	...FOLLOWUP_CDS_INFO_SECTION_CONFIGS.map(
		(section, index) =>
			[
				section.title,
				FOLLOWUP_CDS_SECTION_COLORS[index] ?? FOLLOWUP_CDS_SECTION_COLORS[0],
			] as [string, (typeof FOLLOWUP_CDS_SECTION_COLORS)[number]],
	),
	[
		"Thông tin tờ khai nhập khẩu",
		FOLLOWUP_CDS_SECTION_COLORS[0] ?? FOLLOWUP_CDS_SECTION_COLORS[0],
	],
	[
		"Đơn vị xuất nhập khẩu",
		FOLLOWUP_CDS_SECTION_COLORS[1] ?? FOLLOWUP_CDS_SECTION_COLORS[0],
	],
	["Vận đơn", FOLLOWUP_CDS_SECTION_COLORS[3] ?? FOLLOWUP_CDS_SECTION_COLORS[0]],
	[
		"Thông tin container",
		FOLLOWUP_CDS_SECTION_COLORS[3] ?? FOLLOWUP_CDS_SECTION_COLORS[0],
	],
	[
		"Điều vận container",
		FOLLOWUP_CDS_SECTION_COLORS[6] ?? FOLLOWUP_CDS_SECTION_COLORS[0],
	],
]);

// Helper to retrieve a section (fallback to empty)
export function getSection(title: string) {
	return (
		CDS_SECTION_BY_TITLE.get(title) ?? {
			title,
			fields: [] as FieldConfig[],
		}
	);
}

// Pick specific fields from a section
export function pickSectionFields(
	sectionTitle: string,
	keys: Array<CompositeFieldRef>,
): FieldConfig[] {
	const section = getSection(sectionTitle);
	const fieldsByKey = new Map(
		section.fields.map((field) => [field.key, field] as const),
	);
	return keys.flatMap((entry) => {
		const key = typeof entry === "string" ? entry : entry.key;
		const field = fieldsByKey.get(key);
		if (!field) return [];
		return [{ ...field, ...(typeof entry === "string" ? {} : entry) }];
	});
}

// Composite section builder
export function createCompositeSection(
	title: string,
	groups: Array<{
		sectionTitle: string;
		keys: Array<CompositeFieldRef>;
	}>,
) {
	return {
		title,
		fields: groups.flatMap((group) =>
			pickSectionFields(group.sectionTitle, group.keys),
		),
	};
}

// Date helpers
export function toIsoDate(display: string): string {
	const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	return m ? `${m[3]}-${m[2]}-${m[1]}` : display;
}

export function stopCdsInteraction(event: React.SyntheticEvent) {
	event.preventDefault();
	event.stopPropagation();
}

// UI helpers
export function getSubSectionBeforeField(
	fieldKey: string,
	operationType: string | null,
) {
	if (fieldKey === "importerCode") {
		return operationType === "XUAT" ? "Người xuất khẩu" : "Người nhập khẩu";
	}

	if (fieldKey === "entrustedImporterCode") {
		return operationType === "XUAT"
			? "Người ủy thác xuất khẩu"
			: "Người ủy thác nhập khẩu";
	}

	if (fieldKey === "exporterCode") {
		return operationType === "XUAT" ? "Người nhập khẩu" : "Người xuất khẩu";
	}

	return null;
}
