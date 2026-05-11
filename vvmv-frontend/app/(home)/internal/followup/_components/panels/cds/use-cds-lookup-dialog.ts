// use-cds-lookup-dialog.ts – lookup dialog logic extracted from cds-info-panel.tsx (Phase 3)
"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { normalizeCdsTruckLoadingLocationCodes } from "@/lib/followup/cds-code-values";
import { shouldMatchCdsElectronicAttachmentType } from "@/lib/followup/cds-electronic-attachment-types";
import type { HanDeclarationPrefillMatch } from "@/lib/followup/han-declaration-loader";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";
import type { FollowUpCdsInfoRow, FollowUpRow } from "../../../types";
import { findEcusLocationOptionByValue } from "../ecus-location-options";
import { CDS_FIELD_LABELS } from "./cds-field-labels";
import { LOOKUP_DIALOG_META } from "./cds-lookup-dialog-meta";
import type {
	CdsDatabaseLookupsPayload,
	LookupDialogOption,
	LookupDialogState,
	SelectOption,
} from "./cds-lookup-types";
import {
	buildLookupDialogOptions,
	getFirstSelectedTruckLoadingLocationAddress,
	getFirstSelectedTruckLoadingLocationName,
	getLookupOptionDescription,
	getPairedLookupNameField,
} from "./cds-lookup-utils";

function normalizeLookupText(value: string | null | undefined) {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function normalizeLookupCode(value: string | null | undefined) {
	const normalized = normalizeLookupText(value);
	return normalized ? normalized.toUpperCase() : null;
}

function getLookupDialogDisplayName(option: LookupDialogOption) {
	if (option.description?.trim()) {
		return option.description.trim();
	}

	return getLookupOptionDescription({
		value: option.value,
		label: option.label,
		meta: option.meta,
	});
}

function preferLookupText(
	currentValue: string | null,
	candidateValue: string | null,
) {
	if (!currentValue) {
		return candidateValue;
	}

	if (!candidateValue) {
		return currentValue;
	}

	return candidateValue.length > currentValue.length
		? candidateValue
		: currentValue;
}

function appendUniqueLookupTokens(
	target: Set<string>,
	values: Array<string | null | undefined>,
) {
	for (const value of values) {
		const normalized = normalizeLookupText(value);
		if (normalized) {
			target.add(normalized);
		}
	}
}

function buildExportPermitLookupOptions(
	cdsLookups: CdsDatabaseLookupsPayload | null,
): LookupDialogOption[] {
	const permitEntries = cdsLookups?.permits ?? [];
	if (permitEntries.length === 0) {
		return [];
	}

	const relatedPermitEntries = [
		...(cdsLookups?.importLicenses ?? []),
		...permitEntries,
	];
	const optionsById = new Map<
		string,
		{
			permitNo: string;
			permitTypeCode: string | null;
			permitTypeName: string | null;
			permitIssueDate: string | null;
			permitExpiryDate: string | null;
			sampleDeclarationNos: Set<string>;
			sampleCustomsCodes: Set<string>;
		}
	>();

	for (const item of permitEntries) {
		const permitNo = normalizeLookupText(item.permitNo);
		if (!permitNo) {
			continue;
		}

		const itemPermitTypeCode = normalizeLookupCode(item.permitTypeCode);
		const exactMatch = relatedPermitEntries.find((entry) => {
			const entryPermitNo = normalizeLookupText(entry.permitNo);
			const entryPermitTypeCode = normalizeLookupCode(entry.permitTypeCode);

			return (
				entryPermitNo === permitNo && entryPermitTypeCode === itemPermitTypeCode
			);
		});
		const fallbackMatch =
			exactMatch ??
			relatedPermitEntries.find(
				(entry) => normalizeLookupText(entry.permitNo) === permitNo,
			);

		const permitTypeCode =
			itemPermitTypeCode ?? normalizeLookupCode(fallbackMatch?.permitTypeCode);
		const optionId = `permit-${permitTypeCode ?? "NO_TYPE"}-${permitNo}`;
		const permitTypeName = preferLookupText(
			normalizeLookupText(item.permitTypeName),
			normalizeLookupText(fallbackMatch?.permitTypeName),
		);
		const permitIssueDate = preferLookupText(
			normalizeLookupText(item.permitIssueDate),
			normalizeLookupText(fallbackMatch?.permitIssueDate),
		);
		const permitExpiryDate = preferLookupText(
			normalizeLookupText(item.permitExpiryDate),
			normalizeLookupText(fallbackMatch?.permitExpiryDate),
		);
		const existingOption = optionsById.get(optionId);

		if (existingOption) {
			existingOption.permitTypeCode ??= permitTypeCode;
			existingOption.permitTypeName = preferLookupText(
				existingOption.permitTypeName,
				permitTypeName,
			);
			existingOption.permitIssueDate = preferLookupText(
				existingOption.permitIssueDate,
				permitIssueDate,
			);
			existingOption.permitExpiryDate = preferLookupText(
				existingOption.permitExpiryDate,
				permitExpiryDate,
			);
			appendUniqueLookupTokens(existingOption.sampleDeclarationNos, [
				item.sampleDeclarationNo,
				fallbackMatch?.sampleDeclarationNo,
			]);
			appendUniqueLookupTokens(existingOption.sampleCustomsCodes, [
				item.sampleCustomsCode,
				fallbackMatch?.sampleCustomsCode,
			]);
			continue;
		}

		const sampleDeclarationNos = new Set<string>();
		const sampleCustomsCodes = new Set<string>();

		appendUniqueLookupTokens(sampleDeclarationNos, [
			item.sampleDeclarationNo,
			fallbackMatch?.sampleDeclarationNo,
		]);
		appendUniqueLookupTokens(sampleCustomsCodes, [
			item.sampleCustomsCode,
			fallbackMatch?.sampleCustomsCode,
		]);

		optionsById.set(optionId, {
			permitNo,
			permitTypeCode,
			permitTypeName,
			permitIssueDate,
			permitExpiryDate,
			sampleDeclarationNos,
			sampleCustomsCodes,
		});
	}

	return Array.from(optionsById.entries()).map(([id, option]) => {
		const description = [
			option.permitTypeName,
			option.permitIssueDate ? `Cấp: ${option.permitIssueDate}` : null,
			option.permitExpiryDate ? `Hết hạn: ${option.permitExpiryDate}` : null,
			option.sampleCustomsCodes.size > 0
				? `HQ: ${Array.from(option.sampleCustomsCodes).join(", ")}`
				: null,
		]
			.filter(Boolean)
			.join(" • ");

		return {
			id,
			value: option.permitNo,
			label:
				option.permitTypeCode && option.permitTypeName
					? `${option.permitNo} - ${option.permitTypeCode} - ${option.permitTypeName}`
					: option.permitNo,
			description: description || undefined,
			meta: {
				permitTypeCode: option.permitTypeCode,
			},
			searchText: [
				option.permitNo,
				option.permitTypeCode,
				option.permitTypeName,
				...option.sampleDeclarationNos,
				...option.sampleCustomsCodes,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase(),
		} satisfies LookupDialogOption;
	});
}

export interface UseCdsLookupDialogParams {
	followUpId: string;
	data: Partial<FollowUpCdsInfoRow>;
	cdsLookups: CdsDatabaseLookupsPayload | null;
	resolvedOperationType: FollowUpOperationType | null;
	taxCode?: string | null;
	followUpSummary?: Partial<FollowUpRow> | null;
	getInitialEntryLockReason: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => string | null;
	getLookupOptionsForField: (
		fieldKey: keyof FollowUpCdsInfoRow,
	) => SelectOption[];
	handleFieldChange: (key: string, value: unknown) => void;
	updateElectronicAttachment: (
		index: number,
		field: string,
		value: string,
	) => void;
	updateImportLicenseSlot: (index: number, value: string | null) => void;
	updateLegalDocumentSlot: (index: number, value: string | null) => void;
	updateTransportSchedule: (
		index: number,
		field: string,
		value: string,
	) => void;
	handleApplyCorrespondingDeclarationLookup: (
		declarationNumber: string,
	) => Promise<HanDeclarationPrefillMatch | null>;
	preserveActiveScroll: (callback: () => void) => void;
}

export function useCdsLookupDialog({
	followUpId,
	data,
	cdsLookups,
	resolvedOperationType,
	taxCode,
	followUpSummary,
	getInitialEntryLockReason,
	getLookupOptionsForField,
	handleFieldChange,
	updateElectronicAttachment,
	updateImportLicenseSlot,
	updateLegalDocumentSlot,
	updateTransportSchedule,
	handleApplyCorrespondingDeclarationLookup,
	preserveActiveScroll,
}: UseCdsLookupDialogParams) {
	const [lookupDialogState, setLookupDialogState] =
		useState<LookupDialogState | null>(null);
	const [lookupDialogQuery, setLookupDialogQuery] = useState("");
	const [uploadingAttachmentIndex, setUploadingAttachmentIndex] = useState<
		number | null
	>(null);

	const openLookupDialog = useCallback(
		(nextState: LookupDialogState) => {
			preserveActiveScroll(() => {
				setLookupDialogQuery("");
				setLookupDialogState(nextState);
			});
		},
		[preserveActiveScroll],
	);

	const openLookupDialogForField = useCallback(
		(
			fieldKey: keyof FollowUpCdsInfoRow,
			options?: { displayField?: keyof FollowUpCdsInfoRow },
		) => {
			const lockedReason = getInitialEntryLockReason(fieldKey);
			if (lockedReason) {
				toast.info(lockedReason);
				return;
			}

			const lookupOptions = buildLookupDialogOptions(
				fieldKey,
				getLookupOptionsForField(fieldKey),
			);

			if (lookupOptions.length === 0) {
				const label =
					CDS_FIELD_LABELS.get(String(fieldKey)) ?? String(fieldKey);
				toast.info(`Chưa có danh mục cho "${label}"`);
				return;
			}

			const currentValue =
				data[fieldKey] === null || data[fieldKey] === undefined
					? null
					: String(data[fieldKey]);
			const meta = LOOKUP_DIALOG_META[fieldKey];
			const label = CDS_FIELD_LABELS.get(String(fieldKey)) ?? String(fieldKey);

			openLookupDialog({
				title: meta?.title ?? `Chọn ${label.toLowerCase()}`,
				description:
					meta?.description ?? `Tra cứu và nạp dữ liệu cho trường "${label}".`,
				emptyMessage: meta?.emptyMessage ?? "Chưa có danh mục để chọn.",
				options: lookupOptions,
				selectedValue: currentValue,
				selectedOptionId:
					lookupOptions.find((option) => option.value === currentValue)?.id ??
					null,
				onSelect: (option) => {
					if (fieldKey === "correspondingDeclarationNumber") {
						preserveActiveScroll(() => {
							handleFieldChange(fieldKey as string, option.value);
							setLookupDialogState(null);
						});

						void handleApplyCorrespondingDeclarationLookup(option.value)
							.then((match) => {
								toast.success("Đã nạp số tờ khai tương ứng", {
									description: match?.declarationNumber
										? `Đã nạp thêm dữ liệu từ tờ khai ${match.declarationNumber}.`
										: "Đã nạp thêm dữ liệu liên quan từ HAN_2024.",
								});
							})
							.catch((error) => {
								toast.error(
									"Đã chọn số tương ứng nhưng chưa nạp được chi tiết",
									{
										description:
											error instanceof Error
												? error.message
												: "Lỗi không xác định",
									},
								);
							});
						return;
					}

					preserveActiveScroll(() => {
						handleFieldChange(fieldKey as string, option.value);

						const displayField =
							options?.displayField ?? getPairedLookupNameField(fieldKey);
						if (displayField) {
							handleFieldChange(
								displayField as string,
								getLookupDialogDisplayName(option) || option.value,
							);
						}

						setLookupDialogState(null);
					});
					toast.success(
						meta?.successMessage ?? `Đã nạp ${label.toLowerCase()}.`,
					);
				},
			});
		},
		[
			data,
			getInitialEntryLockReason,
			getLookupOptionsForField,
			handleFieldChange,
			handleApplyCorrespondingDeclarationLookup,
			openLookupDialog,
			preserveActiveScroll,
		],
	);

	const handleOpenExportPermitLookup = useCallback(
		(rowIndex: number) => {
			const options = buildExportPermitLookupOptions(cdsLookups);

			if (options.length === 0) {
				toast.info("Chưa có danh sách giấy phép từ HAN_2024");
				return;
			}

			const currentValue =
				Array.isArray(data.importLicenses) &&
				typeof data.importLicenses[rowIndex] === "string"
					? data.importLicenses[rowIndex]
					: null;

			openLookupDialog({
				title: `Chọn giấy phép xuất khẩu (${rowIndex + 1})`,
				description: "Tra cứu số giấy phép từ dữ liệu HAN_2024 đã từng khai.",
				emptyMessage: "Không có giấy phép phù hợp.",
				options,
				selectedValue: currentValue,
				selectedOptionId:
					options.find((option) => option.value === currentValue)?.id ?? null,
				onSelect: (option) => {
					preserveActiveScroll(() => {
						updateImportLicenseSlot(rowIndex, option.value);
						const permitTypeCode = option.meta?.permitTypeCode?.trim();
						if (permitTypeCode) {
							updateLegalDocumentSlot(rowIndex, permitTypeCode);
						}
						setLookupDialogState(null);
					});
					toast.success("Đã nạp giấy phép xuất khẩu.");
				},
			});
		},
		[
			cdsLookups,
			data.importLicenses,
			openLookupDialog,
			preserveActiveScroll,
			updateImportLicenseSlot,
			updateLegalDocumentSlot,
		],
	);

	const handleOpenElectronicAttachmentLookup = useCallback(
		(rowIndex: number) => {
			const selectedAttachmentTypeCode =
				Array.isArray(data.electronicAttachments) &&
				data.electronicAttachments[rowIndex]?.attachmentDescription
					? String(data.electronicAttachments[rowIndex].attachmentDescription)
							.trim()
							.toUpperCase()
					: null;

			const options: LookupDialogOption[] = (
				cdsLookups?.electronicAttachments ?? []
			)
				.filter((item) => item.attachmentNumber)
				.filter((item) =>
					shouldMatchCdsElectronicAttachmentType(
						selectedAttachmentTypeCode,
						item.attachmentTypeCode,
					),
				)
				.map((item) => ({
					id: `attachment-${item.attachmentTypeCode}-${item.attachmentNumber}`,
					value: item.attachmentNumber ?? "",
					label: item.attachmentNumber ?? "",
					description: item.attachmentDescription
						? `${item.attachmentTypeCode} - ${item.attachmentDescription}`
						: item.attachmentTypeCode,
					meta: {
						attachmentTypeCode: item.attachmentTypeCode,
					},
					searchText:
						`${item.attachmentTypeCode} ${item.attachmentNumber || ""} ${item.attachmentDescription || ""}`.toLowerCase(),
				}));

			if (options.length === 0) {
				toast.info(
					selectedAttachmentTypeCode
						? `Chưa có số đính kèm cho mã ${selectedAttachmentTypeCode} từ HAN_2024`
						: "Chưa có danh sách số đính kèm điện tử từ HAN_2024",
				);
				return;
			}

			const currentValue =
				Array.isArray(data.electronicAttachments) &&
				data.electronicAttachments[rowIndex]?.attachmentNumber
					? data.electronicAttachments[rowIndex].attachmentNumber
					: null;

			openLookupDialog({
				title: `Chọn số đính kèm (${rowIndex + 1})`,
				description: selectedAttachmentTypeCode
					? `Tra cứu số đính kèm điện tử cho mã ${selectedAttachmentTypeCode} từ dữ liệu HAN_2024.`
					: "Tra cứu số đính kèm điện tử từ dữ liệu HAN_2024.",
				emptyMessage: "Không có số đính kèm phù hợp.",
				options,
				selectedValue: currentValue,
				selectedOptionId:
					options.find((option) => option.value === currentValue)?.id ?? null,
				onSelect: (option) => {
					preserveActiveScroll(() => {
						updateElectronicAttachment(
							rowIndex,
							"attachmentNumber",
							option.value,
						);
						if (
							!selectedAttachmentTypeCode &&
							option.meta?.attachmentTypeCode
						) {
							updateElectronicAttachment(
								rowIndex,
								"attachmentDescription",
								option.meta.attachmentTypeCode,
							);
						}
						setLookupDialogState(null);
					});
					toast.success("Đã nạp số đính kèm.");
				},
			});
		},
		[
			cdsLookups?.electronicAttachments,
			data.electronicAttachments,
			openLookupDialog,
			preserveActiveScroll,
			updateElectronicAttachment,
		],
	);

	const handleUploadElectronicAttachment = useCallback(
		(rowIndex: number) => {
			const customerCode =
				taxCode?.trim() ||
				followUpSummary?.taxCode?.trim() ||
				(typeof data.importerCode === "string"
					? data.importerCode.trim()
					: "") ||
				(typeof data.exporterCode === "string" ? data.exporterCode.trim() : "");
			const transId = followUpSummary?.jobNumber?.trim() || followUpId;

			if (!customerCode) {
				toast.error("Thiếu mã số thuế để upload đính kèm điện tử.");
				return;
			}

			if (!resolvedOperationType) {
				toast.error("Thiếu loại hình (NHAP/XUAT) để upload đính kèm điện tử.");
				return;
			}

			if (!transId) {
				toast.error("Thiếu mã job để upload đính kèm điện tử.");
				return;
			}

			const fileInput = document.createElement("input");
			fileInput.type = "file";
			fileInput.multiple = true;
			fileInput.accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.xml";

			fileInput.onchange = () => {
				const files = fileInput.files;
				if (!files || files.length === 0) {
					return;
				}

				void (async () => {
					try {
						setUploadingAttachmentIndex(rowIndex);

						const formData = new FormData();
						formData.append("customerCode", customerCode);
						formData.append("transId", transId);
						formData.append("operationType", resolvedOperationType);
						for (let i = 0; i < files.length; i++) {
							formData.append("files", files[i]);
						}

						const response = await fetch("/api/followup/upload-attachment", {
							method: "POST",
							body: formData,
						});

						const payload = await response.json();
						if (!response.ok) {
							throw new Error(payload.error || "Upload thất bại");
						}

						const result = payload.data as {
							attachmentNumber: string;
							attachmentDescription: string;
						};

						updateElectronicAttachment(
							rowIndex,
							"attachmentNumber",
							result.attachmentNumber,
						);
						updateElectronicAttachment(
							rowIndex,
							"attachmentDescription",
							result.attachmentDescription,
						);

						toast.success("Đã upload và nạp đính kèm điện tử thành công");
					} catch (err) {
						toast.error("Upload đính kèm điện tử thất bại", {
							description:
								err instanceof Error ? err.message : "Lỗi không xác định",
						});
					} finally {
						setUploadingAttachmentIndex(null);
					}
				})();
			};

			fileInput.click();
		},
		[
			data.importerCode,
			data.exporterCode,
			followUpId,
			followUpSummary?.jobNumber,
			followUpSummary?.taxCode,
			resolvedOperationType,
			taxCode,
			updateElectronicAttachment,
		],
	);

	const handleOpenTransportLocationLookup = useCallback(
		(rowIndex: number) => {
			const options = buildLookupDialogOptions(
				"loadingLocationCode",
				getLookupOptionsForField("loadingLocationCode"),
			);

			if (options.length === 0) {
				toast.info("Chưa có danh mục địa điểm từ HAN_2024");
				return;
			}

			const currentCode =
				Array.isArray(data.transportSchedules) &&
				data.transportSchedules[rowIndex]?.locationCode
					? data.transportSchedules[rowIndex].locationCode
					: null;
			const currentName =
				Array.isArray(data.transportSchedules) &&
				data.transportSchedules[rowIndex]?.locationName
					? data.transportSchedules[rowIndex].locationName
					: null;

			openLookupDialog({
				title: `Chọn địa điểm lộ trình (${rowIndex + 1})`,
				description: "Tra cứu tên địa điểm từ dữ liệu HAN_2024.",
				emptyMessage: "Không có địa điểm phù hợp.",
				options,
				selectedValue: currentCode ?? currentName,
				selectedOptionId:
					options.find(
						(option) =>
							option.value === currentCode ||
							option.description === currentName ||
							option.label === currentName,
					)?.id ?? null,
				onSelect: (option) => {
					const nextCode = option.value.trim();
					const nextName =
						option.description?.trim() ||
						(option.label.startsWith(`${nextCode} - `)
							? option.label.slice(`${nextCode} - `.length).trim()
							: option.label.trim()) ||
						nextCode;

					preserveActiveScroll(() => {
						updateTransportSchedule(rowIndex, "locationCode", nextCode);
						updateTransportSchedule(rowIndex, "locationName", nextName);
						setLookupDialogState(null);
					});
					toast.success("Đã nạp địa điểm lộ trình.");
				},
			});
		},
		[
			data.transportSchedules,
			getLookupOptionsForField,
			openLookupDialog,
			preserveActiveScroll,
			updateTransportSchedule,
		],
	);

	const handleOpenTruckLoadingLocationLookup = useCallback(
		(index: number = 0) => {
			const options = buildLookupDialogOptions(
				"truckLoadingLocationCode",
				getLookupOptionsForField("truckLoadingLocationCode").length > 0
					? getLookupOptionsForField("truckLoadingLocationCode")
					: getLookupOptionsForField("loadingLocationCode"),
			);

			if (options.length === 0) {
				toast.info("Chưa có danh mục địa điểm từ HAN_2024");
				return;
			}

			const currentCombined = normalizeCdsTruckLoadingLocationCodes(
				data.truckLoadingLocationCode,
			);
			const parts = String(currentCombined ?? "").split(".");
			const currentValue = parts[index] || null;
			const currentNameParts = Array.from(
				{ length: 5 },
				(_, i) =>
					String(data.truckLoadingLocationName ?? "")
						.split(/\s*,\s*/)
						[i]?.trim() ?? "",
			);

			openLookupDialog({
				title: "Chọn địa điểm xếp hàng (xe tải)",
				description: "Tra cứu mã địa điểm từ dữ liệu HAN_2024.",
				emptyMessage: "Không có địa điểm phù hợp.",
				variant: "location-table",
				searchPlaceholder: "Tìm theo mã hoặc địa điểm...",
				options,
				selectedValue: currentValue,
				selectedOptionId:
					options.find((option) => option.value === currentValue)?.id ?? null,
				onSelect: (option) => {
					const currentCombined = normalizeCdsTruckLoadingLocationCodes(
						data.truckLoadingLocationCode,
					);
					const newParts = Array.from(
						{ length: 5 },
						(_, i) => String(currentCombined ?? "").split(".")[i] ?? "",
					);
					newParts[index] =
						normalizeCdsTruckLoadingLocationCodes(option.value) ?? "";
					const combined = newParts.filter(Boolean).join(".");
					const previousCombined = currentCombined ?? "";
					const nextNameParts = [...currentNameParts];
					nextNameParts[index] =
						option.description?.trim() ||
						findEcusLocationOptionByValue(option.value)?.name ||
						"";
					const selectedAddress = getFirstSelectedTruckLoadingLocationAddress(
						newParts,
						options,
					);
					const currentAddress = String(
						data.truckLoadingLocationAddress ?? "",
					).trim();

					preserveActiveScroll(() => {
						handleFieldChange("truckLoadingLocationCode", combined || null);
						handleFieldChange(
							"truckLoadingLocationName",
							getFirstSelectedTruckLoadingLocationName(
								newParts,
								options,
								nextNameParts,
							),
						);
						if (combined !== previousCombined) {
							handleFieldChange("truckLoadingLocationAddress", selectedAddress);
						} else if (selectedAddress && selectedAddress !== currentAddress) {
							handleFieldChange("truckLoadingLocationAddress", selectedAddress);
						}

						setLookupDialogState(null);
					});
					toast.success(`Đã nạp địa điểm xếp hàng (${index + 1}).`);
				},
			});
		},
		[
			data.truckLoadingLocationCode,
			data.truckLoadingLocationName,
			data.truckLoadingLocationAddress,
			getLookupOptionsForField,
			handleFieldChange,
			openLookupDialog,
			preserveActiveScroll,
		],
	);

	return {
		lookupDialogState,
		setLookupDialogState,
		lookupDialogQuery,
		setLookupDialogQuery,
		uploadingAttachmentIndex,
		openLookupDialogForField,
		handleOpenExportPermitLookup,
		handleOpenElectronicAttachmentLookup,
		handleUploadElectronicAttachment,
		handleOpenTransportLocationLookup,
		handleOpenTruckLoadingLocationLookup,
	};
}
