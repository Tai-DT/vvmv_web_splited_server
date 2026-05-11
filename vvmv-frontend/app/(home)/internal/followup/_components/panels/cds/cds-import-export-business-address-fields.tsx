"use client";

import { useCallback, useEffect, useState } from "react";
import {
	CDS_PARTNER_ADDRESS_LINE_COUNT,
	CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
	splitCdsPartnerAddressText,
} from "@/lib/followup/cds-partner-address";
import { cn } from "@/lib/utils";
import { ecusClassicInputCls } from "./cds-styles";

function padToFour(lines: string[]): string[] {
	const next = [...lines];
	while (next.length < CDS_PARTNER_ADDRESS_LINE_COUNT) {
		next.push("");
	}
	return next.slice(0, CDS_PARTNER_ADDRESS_LINE_COUNT);
}

function splitImportExportBusinessAddressLinesForEcusUi(
	value: string | null | undefined,
): string[] {
	const raw = String(value ?? "").trim();
	if (!raw) {
		return padToFour([]);
	}

	const explicit = raw.split(/\r?\n/).map((line) => line.trim());
	if (explicit.length > 1) {
		return padToFour(
			explicit.map((line) =>
				[...line].slice(0, CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH).join(""),
			),
		);
	}

	return padToFour(
		splitCdsPartnerAddressText(raw, {
			lineCount: CDS_PARTNER_ADDRESS_LINE_COUNT,
			maxLength: CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
		}),
	);
}

function mergeImportExportBusinessAddressLines(
	lines: readonly string[],
): string | null {
	const chunks = lines.map((line) =>
		[...String(line ?? "")]
			.slice(0, CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH)
			.join(""),
	);
	const joined = chunks
		.map((line) => line.trimEnd())
		.filter((line) => line.length > 0)
		.join("\n");
	return joined === "" ? null : joined;
}

export function CdsImportExportBusinessAddressFields({
	value,
	onCommit,
	className,
	singleLine = false,
}: {
	value: string | null | undefined;
	onCommit: (next: string | null) => void;
	className?: string;
	singleLine?: boolean;
}) {
	const [lines, setLines] = useState(() =>
		splitImportExportBusinessAddressLinesForEcusUi(value),
	);

	useEffect(() => {
		setLines(splitImportExportBusinessAddressLinesForEcusUi(value));
	}, [value]);

	const pushCommit = useCallback(
		(nextLines: string[]) => {
			setLines(nextLines);
			onCommit(mergeImportExportBusinessAddressLines(nextLines));
		},
		[onCommit],
	);

	const handleLineChange = (index: number, next: string) => {
		const clamped = [...next]
			.slice(0, CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH)
			.join("");
		const nextLines = [...lines];
		nextLines[index] = clamped;
		pushCommit(nextLines);
	};

	const singleLineValue =
		lines
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.join(", ") || "";

	const handleSingleLineChange = (next: string) => {
		const normalized = next.replace(/\s*\r?\n\s*/g, " ").trim();
		onCommit(normalized === "" ? null : normalized);
	};

	if (singleLine) {
		return (
			<div className={cn("w-full", className)}>
				<input
					type="text"
					value={singleLineValue}
					onChange={(event) => handleSingleLineChange(event.target.value)}
					className={cn(ecusClassicInputCls, "w-full")}
					aria-label="Địa chỉ doanh nghiệp xuất nhập khẩu"
				/>
			</div>
		);
	}

	return (
		<div className={cn("flex w-full flex-wrap items-center gap-1", className)}>
			{Array.from({ length: CDS_PARTNER_ADDRESS_LINE_COUNT }, (_, index) => (
				<input
					key={index}
					type="text"
					maxLength={CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH}
					value={lines[index] ?? ""}
					onChange={(event) => handleLineChange(index, event.target.value)}
					className={cn(ecusClassicInputCls, "w-full sm:w-[248px]")}
					aria-label={`Địa chỉ doanh nghiệp xuất nhập khẩu dòng ${index + 1}`}
				/>
			))}
		</div>
	);
}
