"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CargoListRow, FollowUpCdsInfoRow } from "../../../../types";
import { FOLLOWUP_CARGO_COLUMNS } from "../../panel-config";
import { ecusClassicInputCls } from "../cds-styles";
import { getCdsAiFieldLabel } from "./cds-ai-constants";
import type { CdsAiResultDetailsProps } from "./cds-ai-types";
import {
	formatValue,
	getCargoRowKey,
	getChecklistMeta,
	getDocumentWarningCount,
	isMeaningfulValue,
	isScalarEditable,
	resolveDiffStatus,
} from "./cds-ai-utils";

type SectionKey = "fields" | "cargo" | "checklist" | "documents";

type ScalarFieldReview = {
	fieldKey: string;
	value: unknown;
	diffStatus: "same" | "new" | "changed";
};

function getCompactText(value: unknown, maxLength = 42) {
	const normalized = formatValue(value).replace(/\s+/g, " ").trim();

	if (!normalized) {
		return "Trống";
	}

	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 3)}...`;
}

function getDiffLabel(diffStatus: ScalarFieldReview["diffStatus"]) {
	if (diffStatus === "new") {
		return "Mới";
	}

	if (diffStatus === "changed") {
		return "Khác";
	}

	return "Trùng";
}

function getDiffClass(diffStatus: ScalarFieldReview["diffStatus"]) {
	if (diffStatus === "new") {
		return "border-blue-200 bg-blue-50 text-blue-700";
	}

	if (diffStatus === "changed") {
		return "border-amber-200 bg-amber-50 text-amber-700";
	}

	return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function CompactSection({
	title,
	meta,
	isOpen,
	onToggle,
	danger = false,
	className,
	bodyClassName,
	children,
}: {
	title: string;
	meta?: string;
	isOpen: boolean;
	onToggle: () => void;
	danger?: boolean;
	className?: string;
	bodyClassName?: string;
	children: ReactNode;
}) {
	return (
		<section
			className={cn(
				"overflow-hidden border",
				danger ? "border-red-300 bg-red-50" : "border-[#a8a8a8] bg-white",
				className,
			)}
		>
			<button
				type="button"
				onClick={onToggle}
				className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
			>
				<div
					className={cn(
						"font-semibold",
						danger ? "text-red-800" : "text-[#14314b]",
					)}
				>
					{title}
				</div>
				<div className="flex items-center gap-2 text-[9px] text-slate-500">
					{meta ? <span>{meta}</span> : null}
					<span className="rounded border border-[#cfd6df] bg-[#f8fafc] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-slate-600">
						{isOpen ? "Thu gon" : "Mo ra"}
					</span>
				</div>
			</button>

			{isOpen ? (
				<div
					className={cn(
						"border-t px-2.5 py-2",
						danger ? "border-red-200" : "border-[#d7d7d7]",
						bodyClassName,
					)}
				>
					{children}
				</div>
			) : null}
		</section>
	);
}

export function CdsAiResultDetails({
	latestResult,
	currentData,
	currentCargoList,
	fillMissingOnly,
	operationType,
	fieldDrafts,
	cargoDrafts,
	onSetFieldDrafts,
	onSetCargoDrafts,
	onCommitFieldDraft,
	onCommitCargoDraft,
}: CdsAiResultDetailsProps) {
	const warningCount =
		latestResult.warnings.length + getDocumentWarningCount(latestResult);

	const extractedFieldEntries = useMemo(
		() =>
			Object.entries(latestResult.cdsInfo).filter(([, value]) =>
				isMeaningfulValue(value),
			),
		[latestResult],
	);

	const scalarFieldEntries = useMemo(
		() => extractedFieldEntries.filter(([, value]) => isScalarEditable(value)),
		[extractedFieldEntries],
	);

	const structuredFieldEntries = useMemo(
		() => extractedFieldEntries.filter(([, value]) => !isScalarEditable(value)),
		[extractedFieldEntries],
	);

	const scalarFieldReviews = useMemo<ScalarFieldReview[]>(
		() =>
			scalarFieldEntries.map(([fieldKey, value]) => ({
				fieldKey,
				value,
				diffStatus: resolveDiffStatus(
					currentData?.[fieldKey as keyof FollowUpCdsInfoRow],
					value,
				),
			})),
		[currentData, scalarFieldEntries],
	);

	const cdsDiffSummary = useMemo(() => {
		return {
			newCount: scalarFieldReviews.filter((item) => item.diffStatus === "new")
				.length,
			sameCount: scalarFieldReviews.filter((item) => item.diffStatus === "same")
				.length,
			changedCount: scalarFieldReviews.filter(
				(item) => item.diffStatus === "changed",
			).length,
		};
	}, [scalarFieldReviews]);

	const cargoDiffSummary = useMemo(() => {
		return latestResult.cargoList.reduce(
			(accumulator, row, rowIndex) => {
				const currentRow = (currentCargoList || [])[rowIndex];
				const keys = FOLLOWUP_CARGO_COLUMNS.map((column) => column.key);
				const hasCurrentValues = keys.some((key) =>
					isMeaningfulValue(currentRow?.[key]),
				);
				const hasDifferences = keys.some(
					(key) =>
						resolveDiffStatus(
							currentRow?.[key],
							row[key as keyof CargoListRow],
						) !== "same",
				);

				if (!hasCurrentValues) {
					accumulator.newRows += 1;
				} else if (hasDifferences) {
					accumulator.changedRows += 1;
				} else {
					accumulator.sameRows += 1;
				}

				return accumulator;
			},
			{
				aiRows: latestResult.cargoList.length,
				currentRows: (currentCargoList || []).length,
				newRows: 0,
				changedRows: 0,
				sameRows: 0,
			},
		);
	}, [currentCargoList, latestResult]);

	const quickReviewFields = useMemo(() => {
		const highlightedFields = scalarFieldReviews.filter(
			(item) => item.diffStatus !== "same",
		);

		return (
			highlightedFields.length > 0 ? highlightedFields : scalarFieldReviews
		).slice(0, 6);
	}, [scalarFieldReviews]);

	const checklistReviewCount = useMemo(
		() =>
			latestResult.checklist.filter((item) => item.status !== "found").length,
		[latestResult],
	);

	const documentWarnings = useMemo(
		() =>
			latestResult.documents.flatMap((document) =>
				document.warnings.map((warning) => ({
					fileName: document.fileName,
					warning,
				})),
			),
		[latestResult],
	);

	const quickWarnings = useMemo(
		() =>
			[
				...latestResult.warnings.map((warning) => ({
					label: "He thong",
					text: warning,
				})),
				...documentWarnings.map((item) => ({
					label: item.fileName,
					text: item.warning,
				})),
			].slice(0, 3),
		[documentWarnings, latestResult],
	);

	const defaultSections = useMemo(
		() => ({
			fields:
				scalarFieldEntries.length > 0 &&
				scalarFieldEntries.length <= 4 &&
				structuredFieldEntries.length === 0,
			cargo:
				latestResult.cargoList.length > 0 && latestResult.cargoList.length <= 2,
			checklist: latestResult.checklist.length > 0,
			documents:
				warningCount > 0 ||
				documentWarnings.length > 0 ||
				latestResult.documents.length <= 1,
		}),
		[
			documentWarnings.length,
			latestResult.checklist.length,
			latestResult.cargoList.length,
			latestResult.documents.length,
			scalarFieldEntries.length,
			structuredFieldEntries.length,
			warningCount,
		],
	);

	const [sectionsOpen, setSectionsOpen] = useState(defaultSections);

	useEffect(() => {
		setSectionsOpen(defaultSections);
	}, [defaultSections]);

	const toggleSection = (sectionKey: SectionKey) => {
		setSectionsOpen((current) => ({
			...current,
			[sectionKey]: !current[sectionKey],
		}));
	};

	return (
		<div className="mt-2 min-w-0 w-full overflow-hidden border border-[#a8a8a8] bg-[#efefef] p-1.5 text-[10px] text-[#2f2f2f]">
			<div className="mb-1.5 border border-[#a8a8a8] bg-[linear-gradient(180deg,#f6f6f6_0%,#d7d7d7_100%)] px-2.5 py-1.5 font-bold text-[#14314b]">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						Kết quả AI (
						{fillMissingOnly
							? "CDS chỉ điền ô trống"
							: "CDS chỉ điền ô trống, hàng có thể ghi đè"}
						)
					</div>
					<div className="flex flex-wrap items-center gap-1.5 text-[9px]">
						<span className="rounded border border-[#cfd6df] bg-white px-1.5 py-0.5 text-slate-600">
							{scalarFieldEntries.length} field
						</span>
						<span className="rounded border border-[#cfd6df] bg-white px-1.5 py-0.5 text-slate-600">
							{latestResult.cargoList.length} dong hang
						</span>
						{warningCount > 0 ? (
							<span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-red-700">
								{warningCount} canh bao
							</span>
						) : null}
					</div>
				</div>
			</div>

			<div className="grid gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.85fr)]">
				<div className="border border-[#a8a8a8] bg-white px-2.5 py-2">
					<div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#14314b]">
						Check nhanh
					</div>

					{quickReviewFields.length > 0 ? (
						<div className="grid gap-1 sm:grid-cols-2">
							{quickReviewFields.map((item) => {
								const fieldLabel = getCdsAiFieldLabel(
									item.fieldKey,
									operationType,
								);

								return (
									<div
										key={item.fieldKey}
										className="rounded border border-[#d7d7d7] bg-[#f9fbfd] px-2 py-1"
									>
										<div className="flex items-center gap-1.5">
											<div
												className="min-w-0 flex-1 truncate font-medium text-[#14314b]"
												title={fieldLabel}
											>
												{fieldLabel}
											</div>
											<span
												className={cn(
													"rounded border px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em]",
													getDiffClass(item.diffStatus),
												)}
											>
												{getDiffLabel(item.diffStatus)}
											</span>
										</div>
										<div
											className="mt-0.5 truncate text-[10px] text-[#2d628f]"
											title={formatValue(item.value) || "Trống"}
										>
											{getCompactText(item.value)}
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-[10px] text-slate-500">
							Chưa có dữ liệu bóc tách nổi bật để rà nhanh.
						</div>
					)}

					{scalarFieldReviews.length > quickReviewFields.length ? (
						<div className="mt-1 text-[9px] text-slate-500">
							+{scalarFieldReviews.length - quickReviewFields.length} trường nữa
							trong phần chi tiết.
						</div>
					) : null}
				</div>

				<div className="grid gap-1.5">
					<div className="grid grid-cols-2 gap-1.5">
						<div className="border border-[#a8a8a8] bg-white px-1.5 py-1">
							<div className="text-[8px] uppercase tracking-[0.06em] text-slate-500">
								Field moi
							</div>
							<div className="font-bold text-blue-700">
								{cdsDiffSummary.newCount}
							</div>
						</div>
						<div className="border border-[#a8a8a8] bg-white px-1.5 py-1">
							<div className="text-[8px] uppercase tracking-[0.06em] text-slate-500">
								Field khac
							</div>
							<div className="font-bold text-amber-700">
								{cdsDiffSummary.changedCount}
							</div>
						</div>
						<div className="border border-[#a8a8a8] bg-white px-1.5 py-1">
							<div className="text-[8px] uppercase tracking-[0.06em] text-slate-500">
								Dong moi
							</div>
							<div className="font-bold text-blue-700">
								{cargoDiffSummary.newRows}
							</div>
						</div>
						<div className="border border-[#a8a8a8] bg-white px-1.5 py-1">
							<div className="text-[8px] uppercase tracking-[0.06em] text-slate-500">
								Checklist
							</div>
							<div className="font-bold text-[#14314b]">
								{latestResult.checklist.length - checklistReviewCount}/
								{latestResult.checklist.length}
							</div>
						</div>
					</div>

					{quickWarnings.length > 0 ? (
						<div className="border border-red-300 bg-red-50 px-2 py-1.5">
							<div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-red-700">
								Canh bao can xem ngay
							</div>
							<div className="mt-1 space-y-1">
								{quickWarnings.map((item) => (
									<div key={`${item.label}-${item.text}`} className="leading-4">
										<span className="font-semibold text-red-700">
											{item.label}:
										</span>{" "}
										<span className="text-red-800">
											{getCompactText(item.text, 96)}
										</span>
									</div>
								))}
							</div>
						</div>
					) : (
						<div className="border border-[#a8a8a8] bg-white px-2 py-1.5">
							<div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">
								Nguon du lieu
							</div>
							<div className="mt-1 flex flex-wrap gap-1">
								{latestResult.documents.slice(0, 4).map((document) => (
									<span
										key={document.fileName}
										className="rounded border border-[#d7d7d7] bg-[#f8fafc] px-1.5 py-0.5 text-[9px] text-slate-600"
										title={document.fileName}
									>
										{getCompactText(document.fileName, 26)}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="mt-2 grid gap-2">
				<CompactSection
					title="Chỉ tiêu hải quan"
					meta={`${scalarFieldEntries.length} trường • ${cdsDiffSummary.newCount} mới • ${cdsDiffSummary.changedCount} khác`}
					isOpen={sectionsOpen.fields}
					onToggle={() => toggleSection("fields")}
				>
					{scalarFieldEntries.length > 0 ? (
						<div className="grid gap-x-3 gap-y-1.5 lg:grid-cols-2">
							{scalarFieldEntries.map(([fieldKey, value]) => {
								const diffStatus = resolveDiffStatus(
									currentData?.[fieldKey as keyof FollowUpCdsInfoRow],
									value,
								);

								return (
									<div key={fieldKey} className="flex flex-col gap-0.5">
										<div className="flex items-center gap-1.5">
											<span className="font-semibold">
												{getCdsAiFieldLabel(fieldKey, operationType)}
											</span>
											<span
												className={cn(
													"rounded border px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em]",
													getDiffClass(diffStatus),
												)}
											>
												{getDiffLabel(diffStatus)}
											</span>
										</div>
										<div className="flex flex-col gap-1.5 sm:flex-row">
											<div className="min-w-0 flex-1">
												<Input
													readOnly
													title={
														formatValue(
															currentData?.[
																fieldKey as keyof FollowUpCdsInfoRow
															],
														) || "Trống"
													}
													value={
														formatValue(
															currentData?.[
																fieldKey as keyof FollowUpCdsInfoRow
															],
														) || "Trống"
													}
													className={cn(
														ecusClassicInputCls,
														"cursor-default bg-[#e8e8e8] text-[#777] focus-visible:ring-0",
													)}
												/>
											</div>
											<div className="min-w-0 flex-1">
												<Input
													title={fieldDrafts[fieldKey] ?? formatValue(value)}
													value={fieldDrafts[fieldKey] ?? formatValue(value)}
													onChange={(event) =>
														onSetFieldDrafts((current) => ({
															...current,
															[fieldKey]: event.target.value,
														}))
													}
													onBlur={() => onCommitFieldDraft(fieldKey)}
													className={ecusClassicInputCls}
												/>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-slate-500">Chưa bóc được tiêu chí nào.</div>
					)}

					{structuredFieldEntries.length > 0 ? (
						<div className="mt-3 border-t border-[#d7d7d7] pt-1.5">
							<div className="font-semibold text-[#14314b]">
								Dữ liệu phức tạp (chỉ xem)
							</div>
							<div className="mt-1.5 grid gap-1.5 lg:grid-cols-2">
								{structuredFieldEntries.map(([fieldKey, value]) => (
									<div
										key={fieldKey}
										className="border border-[#d7d7d7] bg-[#f9fbfd] p-1.5"
									>
										<div className="font-semibold">
											{getCdsAiFieldLabel(fieldKey, operationType)}
										</div>
										<div className="whitespace-pre-wrap mt-1 overflow-x-auto border border-[#d7d7d7] bg-white p-1.5 font-mono text-[10px] leading-relaxed text-[#2d628f]">
											{typeof value === "object"
												? JSON.stringify(value, null, 2)
												: formatValue(value)}
										</div>
									</div>
								))}
							</div>
						</div>
					) : null}
				</CompactSection>

				<CompactSection
					title="Danh sách hàng"
					meta={`${cargoDiffSummary.aiRows} dòng AI • ${cargoDiffSummary.newRows} mới • ${cargoDiffSummary.changedRows} khác`}
					isOpen={sectionsOpen.cargo}
					onToggle={() => toggleSection("cargo")}
				>
					<div className="overflow-x-auto">
						<table className="w-full min-w-max border-collapse border border-[#a8a8a8]">
							<thead>
								<tr className="bg-[#e0e0e0] text-center font-semibold">
									<td className="border border-[#a8a8a8] p-1">STT</td>
									{FOLLOWUP_CARGO_COLUMNS.map((col) => (
										<td
											key={col.key}
											className="border border-[#a8a8a8] p-1 whitespace-nowrap"
										>
											{col.label}
										</td>
									))}
								</tr>
							</thead>
							<tbody>
								{latestResult.cargoList.length > 0 ? (
									latestResult.cargoList.map((row, rowIndex) => (
										<tr
											key={getCargoRowKey(row) || rowIndex}
											className="bg-white"
										>
											<td className="border border-[#a8a8a8] bg-[#f5f5f5] p-1 text-center font-bold">
												{rowIndex + 1}
											</td>
											{FOLLOWUP_CARGO_COLUMNS.map((column) => {
												const diffStatus = resolveDiffStatus(
													(currentCargoList || [])[rowIndex]?.[
														column.key as keyof CargoListRow
													],
													row[column.key as keyof CargoListRow],
												);
												const draftKey = `${rowIndex}:${column.key}`;
												const rawValue = row[column.key as keyof CargoListRow];
												const hasValue = isMeaningfulValue(rawValue);

												return (
													<td
														key={column.key}
														className={cn(
															"border border-[#a8a8a8] p-0.5",
															!hasValue && "bg-[#e6ffe6]",
														)}
													>
														<Input
															value={
																cargoDrafts[draftKey] ?? formatValue(rawValue)
															}
															onChange={(event) =>
																onSetCargoDrafts((current) => ({
																	...current,
																	[draftKey]: event.target.value,
																}))
															}
															onBlur={() =>
																onCommitCargoDraft(rowIndex, column.key)
															}
															className={cn(
																"h-[20px] w-full rounded-none border-none bg-transparent px-1 text-[10px] text-[#2d628f] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-blue-400 focus:bg-white",
																diffStatus === "new" &&
																	"font-bold text-blue-800",
																diffStatus === "changed" &&
																	"font-bold text-amber-800",
															)}
														/>
													</td>
												);
											})}
										</tr>
									))
								) : (
									<tr>
										<td
											colSpan={FOLLOWUP_CARGO_COLUMNS.length + 1}
											className="border border-[#a8a8a8] p-2 text-center text-slate-500 bg-white"
										>
											Chưa có dòng hàng
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</CompactSection>

				<div className="grid items-stretch gap-2 xl:grid-cols-2">
					{latestResult.checklist.length > 0 ? (
						<CompactSection
							title="Checklist trích xuất"
							meta={`${latestResult.checklist.length - checklistReviewCount}/${latestResult.checklist.length} đạt`}
							isOpen={sectionsOpen.checklist}
							onToggle={() => toggleSection("checklist")}
							className="h-full"
							bodyClassName="h-full"
						>
							<div className="flex h-full flex-col gap-1">
								{latestResult.checklist.map((item) => {
									const meta = getChecklistMeta(item.status);

									return (
										<div
											key={item.id}
											className="flex gap-2 border-b border-[#e0e0e0] px-1 py-1 last:border-0"
										>
											<span
												className={cn(
													"mt-1.5 size-1.5 shrink-0 rounded-full",
													meta.dotClassName,
												)}
											/>
											<div className="min-w-0 flex-1">
												<div className="font-medium text-slate-800">
													{item.label}
												</div>
												{item.reason ? (
													<div className="text-[10px] text-slate-500">
														{item.reason}
													</div>
												) : null}
											</div>
										</div>
									);
								})}
							</div>
						</CompactSection>
					) : null}

					{latestResult.documents.length > 0 ||
					latestResult.warnings.length > 0 ? (
						<CompactSection
							title="Chứng từ & cảnh báo"
							meta={`${latestResult.documents.length} chứng từ • ${warningCount} cảnh báo`}
							isOpen={sectionsOpen.documents}
							onToggle={() => toggleSection("documents")}
							danger={warningCount > 0}
							className="h-full"
							bodyClassName="h-full"
						>
							{latestResult.warnings.length > 0 ? (
								<div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5">
									<div className="font-semibold text-red-700">
										Cảnh báo chung
									</div>
									<ul className="mt-1 list-disc pl-4 text-[10px] text-red-700">
										{latestResult.warnings.map((warn) => (
											<li
												key={`warning-${warn}`}
												className="mb-1 last:mb-0 leading-relaxed"
											>
												{warn}
											</li>
										))}
									</ul>
								</div>
							) : null}

							{latestResult.documents.length > 0 ? (
								<div className="flex flex-col gap-1.5">
									{latestResult.documents.map((document) => (
										<div
											key={document.fileName}
											className="border border-[#d7d7d7] bg-[#f9fbfd] p-1.5"
										>
											<div className="font-bold">{document.fileName}</div>
											{document.ocrSummary ? (
												<div className="mt-1 text-[9px] text-slate-600">
													{document.ocrSummary}
												</div>
											) : null}
											{document.warnings.length > 0 ? (
												<ul className="mt-1 list-disc pl-4 text-[10px] text-red-600">
													{document.warnings.map((warn) => (
														<li key={`${document.fileName}-${warn}`}>{warn}</li>
													))}
												</ul>
											) : null}
										</div>
									))}
								</div>
							) : (
								<div className="text-slate-500">Chưa có chứng từ nào.</div>
							)}
						</CompactSection>
					) : null}
				</div>
			</div>
		</div>
	);
}
