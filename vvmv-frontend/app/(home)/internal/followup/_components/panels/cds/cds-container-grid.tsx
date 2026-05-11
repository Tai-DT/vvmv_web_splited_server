// cds-container-grid.tsx – container grid extracted from cds-info-panel.tsx (Phase 4)
"use client";

import React from "react";
import { normalizeCdsTruckLoadingLocationCodes } from "@/lib/followup/cds-code-values";
import { cn } from "@/lib/utils";
import type { FollowUpCdsInfoRow } from "../../../types";
import {
	ECUS_LOCATION_OPTIONS,
	findEcusLocationOptionByValue,
} from "../ecus-location-options";
import {
	finalizeNativeSelectInteraction,
	focusNextCdsEditableControl,
	markCdsFocusAnchor,
	markPendingNativeSelectInteraction,
} from "./cds-classic-ui";
import type { SelectOption } from "./cds-lookup-types";
import {
	getFirstSelectedTruckLoadingLocationAddress,
	getFirstSelectedTruckLoadingLocationName,
	getLookupOptionDescription,
	getTruckLoadingLocationOptionAddress,
} from "./cds-lookup-utils";
import { stopCdsInteraction } from "./cds-utils";

export interface CdsContainerGridProps {
	data: Partial<FollowUpCdsInfoRow>;
	handleFieldChange: (key: string, value: unknown) => void;
	suppressManualScrollRestore?: (applyChange: () => void) => void;
	containerGridValues: string[];
	updateContainerNumber: (index: number, value: string) => void;
	handleContainerSlotChange: (index: number, value: string) => Promise<void>;
	handleOpenTruckLoadingLocationLookup: (index: number) => void;
	truckLoadingLocationOptions: SelectOption[];
	containerImportFileRef: React.RefObject<HTMLInputElement | null>;
	handleContainerExcelImport: (
		event: React.ChangeEvent<HTMLInputElement>,
	) => void;
	ecusClassicInputCls: string;
	ecusDisabledFieldCls: string;
	ecusClassicSelectCls: string;
	ecusClassicButtonCls: string;
	ecusDisabledButtonCls: string;
}

type DraftInputProps = Omit<
	React.InputHTMLAttributes<HTMLInputElement>,
	"onChange" | "value"
> & {
	onCommit: (value: string) => void;
	value: string;
};

type DraftTextareaProps = Omit<
	React.TextareaHTMLAttributes<HTMLTextAreaElement>,
	"onChange" | "value"
> & {
	onCommit: (value: string) => void;
	value: string;
};

function isNativeComposing(
	nativeEvent: Event | undefined,
): nativeEvent is Event & { isComposing: true } {
	return (
		(nativeEvent as { isComposing?: boolean } | undefined)?.isComposing === true
	);
}

const DraftInput: React.FC<DraftInputProps> = ({
	value,
	onCommit,
	onBlur,
	onCompositionEnd,
	onCompositionStart,
	onFocus,
	onKeyDown,
	...props
}) => {
	const [draftValue, setDraftValue] = React.useState(value);
	const isComposingRef = React.useRef(false);
	const isFocusedRef = React.useRef(false);
	const latestCommittedValueRef = React.useRef(value);

	React.useEffect(() => {
		if (value === latestCommittedValueRef.current) {
			return;
		}

		latestCommittedValueRef.current = value;

		if (isFocusedRef.current) {
			return;
		}

		setDraftValue(value);
	}, [value]);

	const commitValue = React.useCallback(
		(nextValue: string) => {
			if (nextValue === latestCommittedValueRef.current) {
				return;
			}

			latestCommittedValueRef.current = nextValue;
			onCommit(nextValue);
		},
		[onCommit],
	);

	return (
		<input
			{...props}
			value={draftValue}
			onChange={(event) => setDraftValue(event.target.value)}
			onCompositionStart={(event) => {
				isComposingRef.current = true;
				onCompositionStart?.(event);
			}}
			onCompositionEnd={(event) => {
				isComposingRef.current = false;
				setDraftValue(event.currentTarget.value);
				onCompositionEnd?.(event);
			}}
			onFocus={(event) => {
				isFocusedRef.current = true;
				onFocus?.(event);
			}}
			onBlur={(event) => {
				isFocusedRef.current = false;

				if (!isComposingRef.current && !isNativeComposing(event.nativeEvent)) {
					commitValue(event.currentTarget.value);
				}

				onBlur?.(event);
			}}
			onKeyDown={(event) => {
				if (
					event.key === "Enter" &&
					!isComposingRef.current &&
					!isNativeComposing(event.nativeEvent)
				) {
					event.preventDefault();
					commitValue(event.currentTarget.value);
					focusNextCdsEditableControl(event.currentTarget, {
						direction: "down",
					});
				}

				onKeyDown?.(event);
			}}
		/>
	);
};

const DraftTextarea: React.FC<DraftTextareaProps> = ({
	value,
	onCommit,
	onBlur,
	onCompositionEnd,
	onCompositionStart,
	onFocus,
	...props
}) => {
	const [draftValue, setDraftValue] = React.useState(value);
	const isComposingRef = React.useRef(false);
	const isFocusedRef = React.useRef(false);
	const latestCommittedValueRef = React.useRef(value);

	React.useEffect(() => {
		if (value === latestCommittedValueRef.current) {
			return;
		}

		latestCommittedValueRef.current = value;

		if (isFocusedRef.current) {
			return;
		}

		setDraftValue(value);
	}, [value]);

	const commitValue = React.useCallback(
		(nextValue: string) => {
			if (nextValue === latestCommittedValueRef.current) {
				return;
			}

			latestCommittedValueRef.current = nextValue;
			onCommit(nextValue);
		},
		[onCommit],
	);

	return (
		<textarea
			{...props}
			value={draftValue}
			onChange={(event) => setDraftValue(event.target.value)}
			onCompositionStart={(event) => {
				isComposingRef.current = true;
				onCompositionStart?.(event);
			}}
			onCompositionEnd={(event) => {
				isComposingRef.current = false;
				setDraftValue(event.currentTarget.value);
				onCompositionEnd?.(event);
			}}
			onFocus={(event) => {
				isFocusedRef.current = true;
				onFocus?.(event);
			}}
			onBlur={(event) => {
				isFocusedRef.current = false;

				if (!isComposingRef.current && !isNativeComposing(event.nativeEvent)) {
					commitValue(event.currentTarget.value);
				}

				onBlur?.(event);
			}}
		/>
	);
};

function normalizeTruckLoadingOption(
	option: SelectOption,
): SelectOption | null {
	const normalizedValue = normalizeCdsTruckLoadingLocationCodes(option.value)
		?.split(".")[0]
		?.trim();

	if (!normalizedValue) {
		return null;
	}

	return {
		...option,
		value: normalizedValue,
		label: option.label?.trim() || normalizedValue,
	};
}

function getTruckLoadingOptionName(option: SelectOption | undefined) {
	if (!option) {
		return "";
	}

	return getLookupOptionDescription(option).trim();
}

function getTruckLoadingOptionAddress(option: SelectOption | undefined) {
	return getTruckLoadingLocationOptionAddress(option);
}

function getTruckLoadingOptionDisplay(
	option: SelectOption,
	index: number,
	showOrder: boolean,
) {
	const name = getTruckLoadingOptionName(option);
	const address = getTruckLoadingOptionAddress(option);
	const usedCount = getTruckLoadingOptionUsedCount(option);
	const parts = [
		showOrder ? `${index + 1}.` : null,
		option.value,
		name ? `- ${name}` : null,
		address ? `| ${address}` : null,
		usedCount > 0 ? `(${usedCount})` : null,
	];

	return parts.filter(Boolean).join(" ");
}

function getTruckLoadingOptionUsedCount(option: SelectOption) {
	const parsed = Number.parseInt(option.meta?.usedCount ?? "", 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

export const CdsContainerGrid: React.FC<CdsContainerGridProps> = ({
	data,
	handleFieldChange,
	suppressManualScrollRestore: _suppressManualScrollRestore,
	containerGridValues,
	updateContainerNumber,
	handleContainerSlotChange,
	handleOpenTruckLoadingLocationLookup,
	truckLoadingLocationOptions,
	containerImportFileRef,
	handleContainerExcelImport,
	ecusClassicInputCls,
	ecusDisabledFieldCls: _ecusDisabledFieldCls,
	ecusClassicSelectCls,
	ecusClassicButtonCls,
	ecusDisabledButtonCls: _ecusDisabledButtonCls,
}) => {
	// Split truckLoadingLocationCode into parts (ECUS uses 5 dropdown segments)
	const locationCodeParts = React.useMemo(() => {
		const code = normalizeCdsTruckLoadingLocationCodes(
			data.truckLoadingLocationCode,
		);
		const parts = String(code ?? "").split(".");
		return Array.from({ length: 5 }, (_, i) => parts[i] ?? "");
	}, [data.truckLoadingLocationCode]);

	const locationNameParts = React.useMemo(() => {
		const rawNames = String(data.truckLoadingLocationName ?? "").split(
			/\s*,\s*/,
		);
		return Array.from({ length: 5 }, (_, i) => rawNames[i]?.trim() ?? "");
	}, [data.truckLoadingLocationName]);

	const locationSlots = React.useMemo(() => [0, 1, 2, 3, 4] as const, []);
	const containerSlots = React.useMemo(
		() => Array.from({ length: 50 }, (_, index) => index + 1),
		[],
	);

	const locationSelectOptions = React.useMemo(() => {
		const quickPickOptions = new Map<string, SelectOption>();

		if (truckLoadingLocationOptions.length > 0) {
			[...truckLoadingLocationOptions]
				.sort((left, right) => {
					const countDiff =
						getTruckLoadingOptionUsedCount(right) -
						getTruckLoadingOptionUsedCount(left);

					if (countDiff !== 0) {
						return countDiff;
					}

					return left.value.localeCompare(right.value, "en", {
						numeric: true,
					});
				})
				.forEach((option) => {
					const normalizedOption = normalizeTruckLoadingOption(option);
					if (
						!normalizedOption ||
						quickPickOptions.has(normalizedOption.value)
					) {
						return;
					}

					quickPickOptions.set(normalizedOption.value, normalizedOption);
				});
		} else {
			ECUS_LOCATION_OPTIONS.slice(0, 30).forEach((option) => {
				quickPickOptions.set(option.value, {
					value: option.value,
					label: option.label,
				});
			});
		}

		locationCodeParts.forEach((value, index) => {
			const normalizedValue = value.trim().toUpperCase();
			if (!normalizedValue || quickPickOptions.has(normalizedValue)) {
				return;
			}

			const fallbackName = locationNameParts[index];
			const matchedOption = findEcusLocationOptionByValue(normalizedValue);

			quickPickOptions.set(normalizedValue, {
				value: normalizedValue,
				label:
					fallbackName || matchedOption?.name
						? `${normalizedValue} - ${fallbackName || matchedOption?.name}`
						: normalizedValue,
			});
		});

		return [...quickPickOptions.values()];
	}, [locationCodeParts, locationNameParts, truckLoadingLocationOptions]);

	const normalizedTruckLoadingLocationAddress = String(
		data.truckLoadingLocationAddress ?? "",
	).trim();

	const inferredTruckLoadingLocationAddress = React.useMemo(() => {
		if (
			normalizedTruckLoadingLocationAddress ||
			truckLoadingLocationOptions.length === 0
		) {
			return null;
		}

		return getFirstSelectedTruckLoadingLocationAddress(
			locationCodeParts,
			locationSelectOptions,
		);
	}, [
		locationCodeParts,
		locationSelectOptions,
		normalizedTruckLoadingLocationAddress,
		truckLoadingLocationOptions.length,
	]);

	React.useEffect(() => {
		if (!inferredTruckLoadingLocationAddress) {
			return;
		}

		handleFieldChange(
			"truckLoadingLocationAddress",
			inferredTruckLoadingLocationAddress,
		);
	}, [handleFieldChange, inferredTruckLoadingLocationAddress]);

	const getContainerNumber = (index: number) => {
		return containerGridValues[index] || "";
	};

	const updateTruckLoadingLocation = (
		nextParts: string[],
		nextNameParts: Array<string | null | undefined> = locationNameParts,
	) => {
		const normalizedParts = Array.from({ length: 5 }, (_, index) => {
			const code = normalizeCdsTruckLoadingLocationCodes(nextParts[index]);
			return code?.split(".")[0] ?? "";
		});
		const nextAddress = getFirstSelectedTruckLoadingLocationAddress(
			normalizedParts,
			locationSelectOptions,
		);
		const combined = normalizedParts.filter(Boolean).join(".");
		const currentCombined =
			normalizeCdsTruckLoadingLocationCodes(data.truckLoadingLocationCode) ??
			"";
		handleFieldChange("truckLoadingLocationCode", combined || null);
		handleFieldChange(
			"truckLoadingLocationName",
			getFirstSelectedTruckLoadingLocationName(
				normalizedParts,
				locationSelectOptions,
				nextNameParts,
			),
		);
		if (combined !== currentCombined) {
			handleFieldChange("truckLoadingLocationAddress", nextAddress);
		} else if (
			nextAddress &&
			nextAddress !== normalizedTruckLoadingLocationAddress
		) {
			handleFieldChange("truckLoadingLocationAddress", nextAddress);
		}
	};

	return (
		<div
			className="bg-[#f2f2f2] px-2 sm:px-3 py-3"
			style={{ fontFamily: "Tahoma, Arial, sans-serif" }}
		>
			<div className="border border-slate-400 bg-[#f0f0f0] px-2 sm:px-4 py-4 min-h-[400px] sm:min-h-[600px] text-[12px] text-slate-800">
				{/* Section: Địa điểm xếp hàng */}
				<div className="mb-3">Địa điểm xếp hàng lên xe chở hàng</div>

				<div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-2 mb-6">
					{/* Row 1: Mã */}
					<div className="pt-0.5">Mã:</div>
					<div className="flex flex-wrap items-center gap-x-2 gap-y-2">
						{locationSlots.map((index) => {
							const part = locationCodeParts[index];
							const selectedOption = locationSelectOptions.find(
								(option) => option.value === part,
							);
							const selectedTitle = selectedOption
								? getTruckLoadingOptionDisplay(selectedOption, 0, false)
								: part;

							return (
								<div
									key={`loc-code-${index + 1}`}
									className="flex items-center gap-1"
								>
									<span>({index + 1})</span>
									<div className="flex items-center gap-0.5">
										<select
											aria-label={`Mã địa điểm xếp hàng ${index + 1}`}
											value={part}
											title={selectedTitle}
											onPointerDown={markPendingNativeSelectInteraction}
											onBlur={finalizeNativeSelectInteraction}
											onChange={(e) => {
												const applyChange = () => {
													const selectedValue = e.target.value;
													const selectedTruckLoadingOption =
														locationSelectOptions.find(
															(option) => option.value === selectedValue,
														);
													const newParts = [...locationCodeParts];
													newParts[index] = selectedValue;
													const nextNameParts = [...locationNameParts];
													nextNameParts[index] =
														getTruckLoadingOptionName(
															selectedTruckLoadingOption,
														) ||
														findEcusLocationOptionByValue(selectedValue)
															?.name ||
														"";
													updateTruckLoadingLocation(newParts, nextNameParts);
												};
												applyChange();
												finalizeNativeSelectInteraction();
											}}
											className={cn(
												ecusClassicSelectCls,
												"w-[220px] max-w-full text-[12px]",
											)}
										>
											<option value="" />
											{part ? <option value={part}>{part}</option> : null}
											{locationSelectOptions.map((opt, optionIndex) => (
												<option key={`${opt.value}-detail`} value={opt.value}>
													{getTruckLoadingOptionDisplay(
														opt,
														optionIndex,
														truckLoadingLocationOptions.length > 0,
													)}
												</option>
											))}
										</select>
										<button
											type="button"
											onClick={(event) => {
												stopCdsInteraction(event);
												markCdsFocusAnchor(event.currentTarget);
												handleOpenTruckLoadingLocationLookup(index);
											}}
											className={cn(
												ecusClassicButtonCls,
												"w-6 px-0 text-[11px] pb-1.5",
											)}
										>
											...
										</button>
									</div>
								</div>
							);
						})}
					</div>

					{/* Row 2: Tên */}
					<div className="pt-0.5">Tên:</div>
					<div>
						<DraftInput
							aria-label="Tên địa điểm xếp hàng"
							value={data.truckLoadingLocationName || ""}
							onCommit={(nextValue) =>
								handleFieldChange("truckLoadingLocationName", nextValue)
							}
							className={cn(ecusClassicInputCls, "text-[12px]")}
						/>
					</div>

					{/* Row 3: Địa chỉ */}
					<div className="pt-0.5">Địa chỉ:</div>
					<div>
						<DraftTextarea
							aria-label="Địa chỉ địa điểm xếp hàng"
							value={data.truckLoadingLocationAddress || ""}
							onCommit={(nextValue) =>
								handleFieldChange("truckLoadingLocationAddress", nextValue)
							}
							className={cn(
								ecusClassicInputCls,
								"h-10 p-1 text-[12px] resize-none",
							)}
						/>
					</div>
				</div>

				{/* Section: 50 Container Numbers */}
				<div className="mb-2">Số Container:</div>

				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-1.5 ml-0 sm:ml-[18px]">
					{containerSlots.map((slotNumber) => (
						<div
							key={`cont-slot-${slotNumber}`}
							className="flex items-center gap-1.5"
						>
							<span className="w-[18px] text-right shrink-0">{slotNumber}</span>
							<DraftInput
								aria-label={`Số container ${slotNumber}`}
								value={getContainerNumber(slotNumber - 1)}
								onCommit={(nextValue) =>
									updateContainerNumber(slotNumber - 1, nextValue)
								}
								onBlur={(event) =>
									void handleContainerSlotChange(
										slotNumber - 1,
										event.currentTarget.value,
									)
								}
								className={cn(
									ecusClassicInputCls,
									"w-full sm:w-[130px] px-1.5 py-0 text-[12px]",
								)}
							/>
						</div>
					))}
				</div>

				<div className="mt-2 ml-0 sm:ml-[38px]">
					<button
						type="button"
						onClick={() => containerImportFileRef.current?.click()}
						className="text-[12px] text-blue-700 underline text-left hover:text-blue-900"
					>
						Nhập số Container từ excel
					</button>
					<input
						type="file"
						ref={containerImportFileRef}
						onChange={handleContainerExcelImport}
						accept=".xlsx,.xls"
						className="hidden"
					/>
				</div>
			</div>
		</div>
	);
};
