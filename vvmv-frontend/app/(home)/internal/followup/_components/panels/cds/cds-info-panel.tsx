"use client";

import {
	AlertTriangle,
	Bot,
	ClipboardList,
	Database,
	Download,
	Loader2,
	RefreshCw,
	Send,
} from "lucide-react";
import {
	Fragment,
	type ReactNode,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	buildCdsAiFieldReviewMap,
	type CdsAiReviewedFieldMap,
	getCdsAiFieldReviewSignature,
	isCdsAiFieldReviewResolved,
	normalizeCdsAiComparableValue,
	shouldShowCdsAiFieldReview,
} from "@/lib/followup/cds-ai-review";
import { CDS_ELECTRONIC_ATTACHMENT_TYPE_OPTIONS } from "@/lib/followup/cds-electronic-attachment-types";
import {
	type CdsExportValidationIssue,
	getBlockingCdsExportIssues,
	validateCdsForEcusExport,
} from "@/lib/followup/cds-export-validation";
import {
	CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH,
	isCdsPartnerAddressField,
} from "@/lib/followup/cds-partner-address";
import { normalizeLooseNumber } from "@/lib/followup/number-utils";
import type { FollowUpOperationType } from "@/lib/followup/operation-type";

import { cn } from "@/lib/utils";
import type {
	CargoListRow,
	ContainerRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
	FollowUpRow,
} from "../../../types";
import {
	type CargoListPanelHandle,
	CargoListPanelWithRef,
} from "../cargo-list-panel";
import { CdsAiConflictPicker, CdsAiDocumentPanel, useCdsAiSession } from "./ai";
import {
	BufferedCdsFieldRegistryProvider,
	BufferedTextarea,
	ClassicCodeLookupSelect,
	ClassicDateInput,
	ClassicInput,
	ClassicLabel,
	ClassicLookupCodeAndName,
	ClassicLookupPickerButton,
	ClassicReadonlyInput,
	ClassicSectionHeader,
	ClassicSelect,
	createBufferedCdsFieldRegistry,
	focusNextFromCdsFocusAnchor,
} from "./cds-classic-ui";
import {
	BillItemsTable,
	ElectronicAttachmentsTable,
	ExportLicenseDocumentTable,
	ImportLicenseSlots,
	LegalDocumentSlots,
	TransportSchedulesTable,
	ValuationAdjustmentsTable,
} from "./cds-collection-tables";
import { CdsContainerGrid } from "./cds-container-grid";
import {
	type CdsHanConnectionInfo,
	formatCdsHanConnectionCatalogLabel,
	getCdsHanConnectionSourceLabel,
} from "./cds-han-connection-info";

import type {
	DeclarationDirection,
	FieldRenderLockOptions,
	LookupDialogOption,
	LookupDialogState,
} from "./cds-lookup-types";
import {
	buildLookupDialogOptions,
	getLookupDescription,
	getLookupOptionDescription,
	getOperationCodeDirection,
	usesManualLookupPicker,
} from "./cds-lookup-utils";
import { normalizeImportCollectionFields } from "./cds-normalize";
import {
	ECUS_BUSINESS_GROUP_OPTIONS,
	resolveCdsBusinessTypeGroup,
} from "./cds-options";
import {
	buildHanCandidateComparisonSummary,
	hydrateCdsInfoUiFields,
} from "./cds-prefill";
import { REQUIRED_CDS_FIELDS } from "./cds-required-fields";
import {
	ATTACHMENT_SECTION_TITLES,
	BILL_ITEMS_SECTION_TITLES,
	LEGAL_DOCUMENT_SECTION_TITLES,
	LICENSE_SECTION_TITLES,
	TRANSPORT_SECTION_TITLES,
	VALUATION_SECTION_TITLES,
} from "./cds-sets";
import {
	ecusBillTableInputCls,
	ecusClassicButtonCls,
	ecusClassicInputCls,
	ecusClassicReadonlyCls,
	ecusClassicSelectCls,
	ecusDisabledButtonCls,
	ecusDisabledFieldCls,
	ecusInputCls,
	ecusSelectCls,
	ecusTableInputCls,
	ecusTextareaCls,
} from "./cds-styles";
import { getTabsForOperationType } from "./cds-tab-configs";
import type { FieldConfig } from "./cds-types";
import { EMPTY_CONTAINERS, EMPTY_DECLARATIONS } from "./cds-types";
import { getSubSectionBeforeField, stopCdsInteraction } from "./cds-utils";
import { CdsExportGeneralTab } from "./tabs/cds-export-general-tab";
import { CdsImportGeneralTab1 } from "./tabs/cds-import-general-tab1";
import { CdsImportGeneralTab2 } from "./tabs/cds-import-general-tab2";
import { useCdsCollectionLocks } from "./use-cds-collection-locks";
import { useCdsCollections } from "./use-cds-collections";
import { useCdsContainers } from "./use-cds-containers";
import { useCdsCorrespondingLookup } from "./use-cds-corresponding-lookup";
import { useCdsData } from "./use-cds-data";
import { useCdsFieldLocks } from "./use-cds-field-locks";
import { useCdsForm } from "./use-cds-form";
import { useCdsHanCandidates } from "./use-cds-han-candidates";
import { useCdsLookupDialog } from "./use-cds-lookup-dialog";
import { useCdsLookupOptions } from "./use-cds-lookup-options";
import { useCdsReview } from "./use-cds-review";

const CLASSIC_CODE_ONLY_SELECT_FIELDS = new Set<keyof FollowUpCdsInfoRow>([
	"cargoClassificationCode",
	"declarationProcessingDeptCode",
	"insuranceFeeClassificationCode",
	"insuranceFeeCurrencyCode",
	"invoiceClassificationCode",
	"invoiceCurrency",
	"invoiceFormClassificationCode",
	"invoicePriceCondition",
	"packageType",
	"paymentMethod",
	"personOrganizationClassification",
	"taxPayer",
	"taxableValueCurrencyCode",
	"transportFeeClassificationCode",
	"transportFeeCurrencyCode",
	"transportMethodCode",
	"valuationDeclarationTypeCode",
	"weightUnit",
]);

const ACTIVE_CDS_SCROLL_REGION_SELECTOR = '[data-cds-scroll-region="active"]';
const IMPORT_POLICY_LOCKED_VALIDATION_PATHS = new Set([
	"cdsInfo.taxableValueCurrencyCode",
	"cdsInfo.valuationSummaryReceiptNumber",
	"cdsInfo.totalTaxableValue",
]);

type ScrollCoordinates = {
	top: number;
	left: number;
};

type WindowScrollCoordinates = {
	x: number;
	y: number;
};

type ScrollSnapshot = {
	regionCoordinates: ScrollCoordinates | null;
	windowCoordinates: WindowScrollCoordinates | null;
};

function parseImportLicenseSlotEntry(value: string | null | undefined) {
	const raw = value == null ? "" : String(value).trim();
	if (!raw) {
		return { code: "", number: "" };
	}

	const [code, ...rest] = raw.split(":");
	return {
		code: code.trim(),
		number: rest.join(":").trim(),
	};
}

function buildImportLicenseSlotEntry(code: string, number: string) {
	const normalizedCode = code.trim();
	const normalizedNumber = number.trim();

	if (!normalizedCode && !normalizedNumber) {
		return null;
	}

	if (!normalizedNumber) {
		return normalizedCode || null;
	}

	return normalizedCode
		? `${normalizedCode}:${normalizedNumber}`
		: `:${normalizedNumber}`;
}

interface CdsInfoPanelProps {
	followUpId: string;
	onRefresh?: () => void;
	followUpSummary?: Partial<FollowUpRow> | null;
	operationType?: string | null;
	taxCode?: string | null;
	companyName?: string | null;
	serviceMode?: string | null;
	containers?: ContainerRow[];
	declarations?: DeclarationRow[];
}

function getActiveCdsScrollRegion(root: HTMLDivElement | null) {
	return (
		root?.querySelector<HTMLElement>(ACTIVE_CDS_SCROLL_REGION_SELECTOR) ?? null
	);
}

function captureScrollCoordinates(
	element: HTMLElement | null,
): ScrollCoordinates | null {
	if (!element) {
		return null;
	}

	return {
		top: element.scrollTop,
		left: element.scrollLeft,
	};
}

function captureWindowScrollCoordinates(): WindowScrollCoordinates | null {
	if (typeof window === "undefined") {
		return null;
	}

	return {
		x: window.scrollX,
		y: window.scrollY,
	};
}

function normalizeLookupSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^A-Za-z0-9]+/g, "")
		.toUpperCase();
}

function captureScrollSnapshot(element: HTMLElement | null): ScrollSnapshot {
	return {
		regionCoordinates: captureScrollCoordinates(element),
		windowCoordinates: captureWindowScrollCoordinates(),
	};
}

function restoreScrollCoordinatesAfterPaint(
	root: HTMLDivElement | null,
	snapshot: ScrollSnapshot,
) {
	const restore = () => {
		const nextScrollRegion = getActiveCdsScrollRegion(root);

		if (!nextScrollRegion || !snapshot.regionCoordinates) {
			return;
		}

		if (
			nextScrollRegion.scrollTop === snapshot.regionCoordinates.top &&
			nextScrollRegion.scrollLeft === snapshot.regionCoordinates.left
		) {
			return;
		}

		nextScrollRegion.scrollTop = snapshot.regionCoordinates.top;
		nextScrollRegion.scrollLeft = snapshot.regionCoordinates.left;
	};

	restore();

	if (typeof window === "undefined") {
		return;
	}

	if (typeof window.requestAnimationFrame === "function") {
		window.requestAnimationFrame(() => {
			restore();
		});
	}
}

function isTypingTarget(element: Element | null) {
	if (!(element instanceof HTMLElement)) {
		return false;
	}

	if (element.isContentEditable) {
		return true;
	}

	if (element instanceof HTMLTextAreaElement) {
		return true;
	}

	if (element instanceof HTMLInputElement) {
		return !["checkbox", "radio", "button", "submit"].includes(element.type);
	}

	return false;
}

export function CdsInfoPanel({
	followUpId,
	onRefresh,
	followUpSummary,
	operationType,
	containers = EMPTY_CONTAINERS,
	declarations = EMPTY_DECLARATIONS,
	taxCode,
	companyName,
	serviceMode: _serviceMode,
}: CdsInfoPanelProps) {
	const {
		data,
		cargoList,
		setData,
		setCargoList,
		cdsLookups,
		companyProfile,
		hanConnection,
		setHanConnection,
		hanConnectionError,
		setHanConnectionError,
		isLoading,
		isLookupLoading,
		error,
		resolvedOperationType,
		fetchData,
		handleReloadLookups,
	} = useCdsData({
		followUpId,
		operationType: (operationType || null) as FollowUpOperationType | null,
		followUpSummary,
		declarations,
	});

	const handleHanConnectionResolved = useCallback(
		(info: CdsHanConnectionInfo | null) => {
			setHanConnection(info);
			setHanConnectionError(null);
		},
		[setHanConnection, setHanConnectionError],
	);

	const {
		containerImportFileRef,
		containerGridValues,
		handleContainerSlotChange,
		handleContainerExcelImport,
		updateContainerNumber,
	} = useCdsContainers({
		followUpId,
		containers,
		onRefresh,
	});

	const bufferedFieldRegistryRef = useRef(createBufferedCdsFieldRegistry());
	const flushBufferedFieldCommitsAndWait = useCallback(async () => {
		await bufferedFieldRegistryRef.current.flushAndWait();
	}, []);

	const {
		isSaving,
		isRegistering,
		showConfirmDialog,
		setShowConfirmDialog,
		cdsStatus: _cdsStatus,
		isSubmitted,
		handleSave,
		handleRegisterDeclaration,
		executeRegisterDeclaration,
		saveCurrentCdsInfo,
	} = useCdsReview({
		followUpId,
		data,
		setData,
		setCargoList,
		flushBufferedFieldCommitsAndWait,
		onRefresh,
		onHanConnectionResolved: handleHanConnectionResolved,
	});

	const {
		showHanCandidateDialog,
		setShowHanCandidateDialog,
		hanCandidates,
		hanCandidatesLoading,
		hanCandidatesError,
		selectedHanCandidateId,
		setSelectedHanCandidateId,
		handleOpenHanCandidates,
	} = useCdsHanCandidates({
		followUpId,
		resolvedOperationType,
		onHanConnectionResolved: handleHanConnectionResolved,
	});

	const {
		updateBillItem,
		updateValuationAdjustment,
		updateElectronicAttachment,
		updateTransportSchedule,
		updateImportLicenseSlot,
		updateLegalDocumentSlot,
	} = useCdsCollections({ setData });

	const { handleApplyCorrespondingDeclarationLookup } =
		useCdsCorrespondingLookup({
			followUpId,
			data,
			resolvedOperationType,
			setData,
			setCargoList,
			onHanConnectionResolved: handleHanConnectionResolved,
		});

	const {
		isAppIssuedDeclaration,
		appIssuedDeclarationLockReason,
		isNewCdsDraft,
		getInitialEntryLockReason,
		resolveFieldLockState,
		getImportImage1FieldLockOptions,
		getExportFieldLockOptions,
	} = useCdsFieldLocks({
		data,
		resolvedOperationType,
	});

	const lookupDirection = useMemo<DeclarationDirection>(() => {
		if (resolvedOperationType === "NHAP") {
			return "import";
		}

		if (resolvedOperationType === "XUAT") {
			return "export";
		}

		return getOperationCodeDirection(
			typeof data.operationCode === "string" ? data.operationCode : null,
		);
	}, [data.operationCode, resolvedOperationType]);

	const {
		suggestedProcessingDepartment,
		getLookupOptionsForField,
		getLookupSourceForField,
		getLookupSourceDetail,
	} = useCdsLookupOptions({ cdsLookups, lookupDirection, data });

	const deferredValidationData = useDeferredValue(data);
	const deferredCargoList = useDeferredValue(cargoList);
	const deferredDeclarations = useDeferredValue(declarations);
	const deferredFollowUpSummary = useDeferredValue(followUpSummary);
	const latestDataRef = useRef(data);
	const latestCargoListRef = useRef(cargoList);
	const cargoListPanelRef = useRef<CargoListPanelHandle | null>(null);
	const [isSyncingCargo, setIsSyncingCargo] = useState(false);
	const [isSyncingAppDeclaration, setIsSyncingAppDeclaration] = useState(false);
	const [cargoPanelRefreshKey, setCargoPanelRefreshKey] = useState(0);

	latestDataRef.current = data;
	latestCargoListRef.current = cargoList;

	const cdsPanelBodyRef = useRef<HTMLDivElement | null>(null);
	const manualScrollRestoreSuppressionDepthRef = useRef(0);

	const suppressManualScrollRestore = useCallback((applyChange: () => void) => {
		manualScrollRestoreSuppressionDepthRef.current += 1;

		try {
			applyChange();
		} finally {
			manualScrollRestoreSuppressionDepthRef.current = Math.max(
				0,
				manualScrollRestoreSuppressionDepthRef.current - 1,
			);
		}
	}, []);

	const preserveActiveTabScroll = useCallback((applyChange: () => void) => {
		const activeScrollRegion = getActiveCdsScrollRegion(
			cdsPanelBodyRef.current,
		);
		const previousScrollSnapshot = captureScrollSnapshot(activeScrollRegion);
		const shouldSkipManualRestore =
			manualScrollRestoreSuppressionDepthRef.current > 0;

		applyChange();

		if (
			shouldSkipManualRestore ||
			(previousScrollSnapshot.regionCoordinates === null &&
				previousScrollSnapshot.windowCoordinates === null)
		) {
			return;
		}

		// Do not force scroll restoration while user is actively typing.
		if (
			activeScrollRegion &&
			typeof document !== "undefined" &&
			activeScrollRegion.contains(document.activeElement) &&
			isTypingTarget(document.activeElement)
		) {
			return;
		}

		restoreScrollCoordinatesAfterPaint(
			cdsPanelBodyRef.current,
			previousScrollSnapshot,
		);
	}, []);

	const { handleFieldChange: baseHandleFieldChange } = useCdsForm({
		data,
		setData,
		preserveActiveScroll: preserveActiveTabScroll,
		resolvedOperationType,
		taxCode,
		companyName,
		followUpSummary,
		companyProfile,
		getLookupOptionsForField,
	});

	const persistCargoList = useCallback(async () => {
		if (!cargoListPanelRef.current) {
			return true;
		}

		setIsSyncingCargo(true);
		try {
			return await cargoListPanelRef.current.save({ quietSuccess: true });
		} finally {
			setIsSyncingCargo(false);
		}
	}, []);

	const getCurrentCargoList = useCallback(
		() => cargoListPanelRef.current?.getRows() ?? latestCargoListRef.current,
		[],
	);

	const handleFieldChange = useCallback(
		(key: string, value: unknown) => {
			if (isAppIssuedDeclaration) {
				return;
			}

			preserveActiveTabScroll(() => {
				baseHandleFieldChange(key, value);
			});
		},
		[baseHandleFieldChange, isAppIssuedDeclaration, preserveActiveTabScroll],
	);

	useEffect(() => {
		const currentPackageType = String(data.packageType ?? "").trim();
		if (!currentPackageType) {
			return;
		}

		const packageTypeOptions = getLookupOptionsForField("packageType");
		if (packageTypeOptions.length === 0) {
			return;
		}

		const isValidPackageType = packageTypeOptions.some((option) => {
			const optionValue = option.value.trim();
			return (
				currentPackageType === optionValue ||
				currentPackageType.startsWith(`${optionValue} - `)
			);
		});

		if (isValidPackageType) {
			return;
		}

		preserveActiveTabScroll(() => {
			setData((prev) => ({ ...prev, packageType: null }));
		});
	}, [
		data.packageType,
		getLookupOptionsForField,
		preserveActiveTabScroll,
		setData,
	]);

	const handleAiDocumentCargoApplied = useCallback(
		(rows: Partial<CargoListRow>[]) => {
			setCargoList(rows);
			setCargoPanelRefreshKey((current) => current + 1);
		},
		[setCargoList],
	);

	const handleAiDocumentCdsInfoPersisted = useCallback(
		(nextData: Partial<FollowUpCdsInfoRow>) => {
			setData(
				hydrateCdsInfoUiFields(normalizeImportCollectionFields(nextData)),
			);
			onRefresh?.();
		},
		[onRefresh, setData],
	);

	const cdsAiSession = useCdsAiSession({
		followUpId,
		operationType: resolvedOperationType,
		followUpSummary,
		currentData: data,
		currentCargoList: cargoList,
		handleFieldChange,
		onCdsInfoPersisted: handleAiDocumentCdsInfoPersisted,
		onCargoApplied: handleAiDocumentCargoApplied,
	});

	const updateBillItemWithScroll = useCallback(
		(index: number, field: string, value: string) => {
			preserveActiveTabScroll(() => {
				updateBillItem(index, field, value);
			});
		},
		[preserveActiveTabScroll, updateBillItem],
	);

	const updateValuationAdjustmentWithScroll = useCallback(
		(index: number, field: string, value: string) => {
			preserveActiveTabScroll(() => {
				updateValuationAdjustment(index, field, value);
			});
		},
		[preserveActiveTabScroll, updateValuationAdjustment],
	);

	const updateElectronicAttachmentWithScroll = useCallback(
		(index: number, field: string, value: string) => {
			preserveActiveTabScroll(() => {
				updateElectronicAttachment(index, field, value);
			});
		},
		[preserveActiveTabScroll, updateElectronicAttachment],
	);

	const updateTransportScheduleWithScroll = useCallback(
		(index: number, field: string, value: string) => {
			preserveActiveTabScroll(() => {
				updateTransportSchedule(index, field, value);
			});
		},
		[preserveActiveTabScroll, updateTransportSchedule],
	);

	const updateImportLicenseSlotWithScroll = useCallback(
		(index: number, value: string | null) => {
			preserveActiveTabScroll(() => {
				updateImportLicenseSlot(index, value);
			});
		},
		[preserveActiveTabScroll, updateImportLicenseSlot],
	);

	const updateLegalDocumentSlotWithScroll = useCallback(
		(index: number, value: string | null) => {
			preserveActiveTabScroll(() => {
				updateLegalDocumentSlot(index, value);
			});
		},
		[preserveActiveTabScroll, updateLegalDocumentSlot],
	);

	const updateContainerNumberWithScroll = useCallback(
		(index: number, value: string) => {
			preserveActiveTabScroll(() => {
				updateContainerNumber(index, value);
			});
		},
		[preserveActiveTabScroll, updateContainerNumber],
	);

	const [activeTab, setActiveTab] = useState("general");
	const [isAiChatOpen, setIsAiChatOpen] = useState(false);
	const [aiReviewedFieldMap, setAiReviewedFieldMap] =
		useState<CdsAiReviewedFieldMap>({});
	const [isExporting, setIsExporting] = useState(false);
	const [showValidationPanel, setShowValidationPanel] = useState(false);

	const {
		getBillItemRowLockReason,
		getLegalDocumentSlotLockReason,
		getImportLicenseSlotLockReason,
		getExportLicenseRowLockReason,
		getValuationAdjustmentLockReason,
		getElectronicAttachmentLockReason,
		getTransportScheduleLockReason,
	} = useCdsCollectionLocks({
		data,
		resolvedOperationType,
	});

	const tabConfigs = useMemo(
		() => getTabsForOperationType(resolvedOperationType),
		[resolvedOperationType],
	);
	const aiFieldReviewMap = useMemo(
		() =>
			buildCdsAiFieldReviewMap({
				beforeData: cdsAiSession.lastAutoApplySnapshot,
				currentData: data,
				result: cdsAiSession.latestResult,
			}),
		[cdsAiSession.lastAutoApplySnapshot, cdsAiSession.latestResult, data],
	);
	const aiReviewResetKey = `${cdsAiSession.activeResultMessageId ?? ""}:${cdsAiSession.latestResult?.assistantMessage ?? ""}`;
	const aiFieldReviewTotal = useMemo(
		() =>
			Object.values(aiFieldReviewMap).filter(
				(review) =>
					shouldShowCdsAiFieldReview(review) &&
					!isCdsAiFieldReviewResolved(
						review,
						aiReviewedFieldMap[review.fieldKey],
					),
			).length,
		[aiFieldReviewMap, aiReviewedFieldMap],
	);
	const isCdsAiBusy =
		cdsAiSession.isAnalyzing ||
		cdsAiSession.isUploadingToDrive ||
		cdsAiSession.isLoadingHistory;
	const handleCdsAiFloatingAction = useCallback(() => {
		setIsAiChatOpen(true);

		if (isCdsAiBusy) {
			return;
		}

		if (!cdsAiSession.canAnalyze) {
			toast.info("Chọn chứng từ hoặc nhập yêu cầu trước khi chạy CDS AI.");
			return;
		}

		cdsAiSession.handleAnalyze();
	}, [cdsAiSession.canAnalyze, cdsAiSession.handleAnalyze, isCdsAiBusy]);
	const cdsAiFloatingLabel = cdsAiSession.isAnalyzing
		? "Đang chạy AI"
		: cdsAiSession.canAnalyze
			? "Chạy CDS AI"
			: "CDS AI";
	const cdsAiFloatingTitle = cdsAiSession.canAnalyze
		? "Mở panel và chạy CDS AI ngay"
		: "Mở CDS AI để chọn chứng từ hoặc nhập yêu cầu";
	const aiFieldReviewCountsByTab = useMemo(() => {
		const counts: Record<string, number> = {};

		tabConfigs.forEach((tab) => {
			const fieldKeys = new Set<keyof FollowUpCdsInfoRow>();
			tab.sections.forEach((section) => {
				section.fields.forEach((field) => {
					fieldKeys.add(field.key as keyof FollowUpCdsInfoRow);
				});
			});

			counts[tab.id] = Array.from(fieldKeys).filter((fieldKey) => {
				const review = aiFieldReviewMap[fieldKey];
				return (
					shouldShowCdsAiFieldReview(review) &&
					!isCdsAiFieldReviewResolved(review, aiReviewedFieldMap[fieldKey])
				);
			}).length;
		});

		return counts;
	}, [aiFieldReviewMap, aiReviewedFieldMap, tabConfigs]);

	useEffect(() => {
		void aiReviewResetKey;
		setAiReviewedFieldMap({});
	}, [aiReviewResetKey]);

	const canExportDeclaration =
		resolvedOperationType === "NHAP" || resolvedOperationType === "XUAT";
	const exportDeclarationTitle =
		resolvedOperationType === "NHAP"
			? "Xuất file Excel theo mẫu tờ khai nhập khẩu"
			: "Xuất file Excel theo mẫu tờ khai xuất khẩu";
	const validationResult = useMemo(
		() =>
			canExportDeclaration
				? validateCdsForEcusExport({
						cdsInfo: deferredValidationData,
						cargoList: deferredCargoList,
						declarations: deferredDeclarations,
						followUpSummary: deferredFollowUpSummary ?? undefined,
						companyProfile,
						operationType: resolvedOperationType,
					})
				: null,
		[
			canExportDeclaration,
			deferredCargoList,
			deferredDeclarations,
			deferredFollowUpSummary,
			deferredValidationData,
			companyProfile,
			resolvedOperationType,
		],
	);
	const validationIssues = useMemo(() => {
		const allIssues = validationResult?.issues ?? [];
		if (resolvedOperationType !== "NHAP") {
			return allIssues;
		}

		return allIssues.filter(
			(issue) => !IMPORT_POLICY_LOCKED_VALIDATION_PATHS.has(issue.path),
		);
	}, [resolvedOperationType, validationResult?.issues]);
	const blockingValidationIssues = useMemo(
		() => getBlockingCdsExportIssues(validationIssues),
		[validationIssues],
	);
	const warningValidationIssues = useMemo(
		() => validationIssues.filter((issue) => issue.severity === "warning"),
		[validationIssues],
	);
	const validationSummaryLabel =
		blockingValidationIssues.length > 0
			? `${blockingValidationIssues.length} lỗi cần sửa`
			: warningValidationIssues.length > 0
				? `${warningValidationIssues.length} cảnh báo cần rà soát`
				: "Dữ liệu đã sẵn sàng để truyền";
	const hanConnectionCatalogLabel = useMemo(
		() => formatCdsHanConnectionCatalogLabel(hanConnection),
		[hanConnection],
	);
	const hanConnectionSourceLabel = useMemo(
		() => getCdsHanConnectionSourceLabel(hanConnection),
		[hanConnection],
	);
	const hanConnectionSiteLabel = hanConnection?.site ?? "—";
	const hanConnectionTitle = hanConnection
		? `Data của người dùng truyền VNACC: ${hanConnectionCatalogLabel}. Site: ${hanConnectionSiteLabel}. Nguồn: ${hanConnectionSourceLabel}. MST: ${hanConnection.taxCode ?? "—"}.`
		: (hanConnectionError ??
			"Chưa xác định data của người dùng để truyền VNACC.");
	const hanConnectionUnavailableMessage =
		hanConnectionError ??
		"Chưa có cấu hình data của người dùng cho MST/site hiện tại.";
	const canTransmitToHan = Boolean(hanConnection);
	const transmitButtonTitle = canTransmitToHan
		? "Truyền dữ liệu CDS qua app xuất nhập khẩu"
		: hanConnectionUnavailableMessage;

	const resolvedActiveTab = useMemo(() => {
		const fallbackTabId =
			tabConfigs.find(
				(tab) =>
					tab.id === "general" ||
					tab.id === "import-general-1" ||
					tab.id === "export-general",
			)?.id ??
			tabConfigs[0]?.id ??
			"general";
		return tabConfigs.some((tab) => tab.id === activeTab)
			? activeTab
			: fallbackTabId;
	}, [activeTab, tabConfigs]);
	const activeTabConfig = useMemo(
		() => tabConfigs.find((tab) => tab.id === resolvedActiveTab) ?? null,
		[resolvedActiveTab, tabConfigs],
	);

	const handleExportDeclaration = useCallback(async () => {
		if (!canExportDeclaration) {
			return;
		}

		const cargoSaved = await persistCargoList();
		if (!cargoSaved) {
			return;
		}

		setIsExporting(true);
		try {
			await saveCurrentCdsInfo(false, { preserveLifecycle: true });

			const response = await fetch(`/api/followup/${followUpId}/export`, {
				cache: "no-store",
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				const issues = Array.isArray(payload?.issues)
					? (payload.issues as CdsExportValidationIssue[])
					: [];
				const issueText =
					issues.length > 0
						? issues
								.slice(0, 3)
								.map((issue) => String(issue?.message ?? "").trim())
								.filter(Boolean)
								.join(" ")
						: "";

				throw new Error(
					[payload?.error, issueText]
						.map((value) => String(value ?? "").trim())
						.filter(Boolean)
						.join(" "),
				);
			}

			const blob = await response.blob();
			const contentDisposition =
				response.headers.get("Content-Disposition") ?? "";
			const encodedFileName = contentDisposition.match(
				/filename\*=UTF-8''([^;]+)/i,
			)?.[1];
			const basicFileName =
				contentDisposition.match(/filename="?([^"]+)"?/i)?.[1];
			const fileName = encodedFileName
				? decodeURIComponent(encodedFileName)
				: basicFileName || "xuat ToKhaiExport.xls";

			const downloadUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = downloadUrl;
			link.download = fileName;
			link.style.display = "none";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(downloadUrl);

			toast.success("Đã xuất file Excel", {
				description: fileName,
			});
		} catch (error) {
			toast.error("Xuất Excel thất bại", {
				description:
					error instanceof Error ? error.message : "Lỗi không xác định",
			});
		} finally {
			setIsExporting(false);
		}
	}, [canExportDeclaration, followUpId, persistCargoList, saveCurrentCdsInfo]);

	const handleOpenValidationPanel = useCallback(() => {
		setShowValidationPanel((current) => !current);
	}, []);

	const handlePreflightRegister = useCallback(async () => {
		if (!canTransmitToHan) {
			toast.error("Chưa thể truyền qua app", {
				description: hanConnectionUnavailableMessage,
			});
			return;
		}

		const cargoSaved = await persistCargoList();
		if (!cargoSaved) {
			return;
		}

		await flushBufferedFieldCommitsAndWait();

		try {
			await saveCurrentCdsInfo(false, { preserveLifecycle: true });
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Không thể lưu dữ liệu trước khi truyền qua VNACC",
			);
			return;
		}

		const freshValidationResult = validateCdsForEcusExport({
			cdsInfo: latestDataRef.current,
			cargoList: getCurrentCargoList(),
			declarations,
			followUpSummary: followUpSummary ?? undefined,
			companyProfile,
			operationType: resolvedOperationType,
		});
		const freshBlockingIssues = getBlockingCdsExportIssues(
			freshValidationResult.issues,
		);

		if (freshBlockingIssues.length > 0) {
			setShowValidationPanel(true);
			toast.error("Chưa thể truyền qua VNACC", {
				description: freshBlockingIssues
					.slice(0, 4)
					.map((issue) => issue.message)
					.join(" "),
			});
			return;
		}

		handleRegisterDeclaration();
	}, [
		declarations,
		flushBufferedFieldCommitsAndWait,
		followUpSummary,
		companyProfile,
		getCurrentCargoList,
		handleRegisterDeclaration,
		canTransmitToHan,
		hanConnectionUnavailableMessage,
		persistCargoList,
		resolvedOperationType,
		saveCurrentCdsInfo,
	]);

	const handleSaveWithCargoSync = useCallback(async () => {
		if (isAppIssuedDeclaration) {
			toast.warning("Tờ khai đã được app cấp số", {
				description:
					appIssuedDeclarationLockReason ??
					"Web không cập nhật trực tiếp tờ khai này.",
			});
			return;
		}

		const cargoSaved = await persistCargoList();
		if (!cargoSaved) {
			return;
		}

		await handleSave();
	}, [
		appIssuedDeclarationLockReason,
		handleSave,
		isAppIssuedDeclaration,
		persistCargoList,
	]);

	const handleSyncAppDeclaration = useCallback(async () => {
		if (!isAppIssuedDeclaration || isSyncingAppDeclaration) {
			return;
		}

		setIsSyncingAppDeclaration(true);
		try {
			const response = await fetch(
				`/api/followup/${followUpId}/app-declaration/sync`,
				{ method: "POST" },
			);
			const payload = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(payload?.error || "Không thể đồng bộ tờ khai từ app");
			}

			const syncedData = payload?.data as
				| Partial<FollowUpCdsInfoRow>
				| undefined;
			if (syncedData && typeof syncedData === "object") {
				setData(
					hydrateCdsInfoUiFields(normalizeImportCollectionFields(syncedData)),
				);
			}

			const nextCargoList = Array.isArray(payload?.cargoList)
				? (payload.cargoList as Partial<CargoListRow>[])
				: [];
			setCargoList(nextCargoList);
			setCargoPanelRefreshKey((current) => current + 1);
			onRefresh?.();

			toast.success("Đã đồng bộ tờ khai từ app", {
				description: `Số tờ khai: ${syncedData?.declarationNumber ?? data.declarationNumber ?? "—"}.`,
			});
		} catch (error) {
			toast.error("Đồng bộ data của người dùng thất bại", {
				description:
					error instanceof Error ? error.message : "Lỗi không xác định",
			});
		} finally {
			setIsSyncingAppDeclaration(false);
		}
	}, [
		data.declarationNumber,
		followUpId,
		isAppIssuedDeclaration,
		isSyncingAppDeclaration,
		onRefresh,
		setCargoList,
		setData,
	]);

	useEffect(() => {
		if (resolvedActiveTab !== activeTab) {
			setActiveTab(resolvedActiveTab);
		}
	}, [activeTab, resolvedActiveTab]);

	const {
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
	} = useCdsLookupDialog({
		followUpId,
		data,
		cdsLookups,
		resolvedOperationType,
		taxCode,
		followUpSummary,
		getInitialEntryLockReason,
		getLookupOptionsForField,
		handleFieldChange,
		updateElectronicAttachment: updateElectronicAttachmentWithScroll,
		updateImportLicenseSlot: updateImportLicenseSlotWithScroll,
		updateLegalDocumentSlot: updateLegalDocumentSlotWithScroll,
		updateTransportSchedule: updateTransportScheduleWithScroll,
		handleApplyCorrespondingDeclarationLookup,
		preserveActiveScroll: preserveActiveTabScroll,
	});

	const openCollectionLookupDialog = useCallback(
		(nextState: LookupDialogState) => {
			preserveActiveTabScroll(() => {
				setLookupDialogQuery("");
				setLookupDialogState(nextState);
			});
		},
		[preserveActiveTabScroll, setLookupDialogQuery, setLookupDialogState],
	);

	const handleOpenImportLicenseTypeLookup = useCallback(
		(rowIndex: number) => {
			const rowLockReason = getImportLicenseSlotLockReason(rowIndex);
			if (rowLockReason) {
				toast.info(rowLockReason);
				return;
			}

			const options = buildLookupDialogOptions(
				"importLicense",
				getLookupOptionsForField("importLicense"),
			);

			if (options.length === 0) {
				toast.info("Chưa có danh mục mã giấy phép nhập khẩu", {
					description:
						"Khi không có chuỗi kết nối MSSQL thật, chạy `npm run sync:permit-catalog` (read-only). Nếu vẫn rỗng, kiểm tra API CDS lookups và reload.",
				});
				return;
			}

			const currentRawValue =
				Array.isArray(data.importLicenses) &&
				typeof data.importLicenses[rowIndex] === "string"
					? data.importLicenses[rowIndex]
					: null;
			const { code, number } = parseImportLicenseSlotEntry(currentRawValue);

			openCollectionLookupDialog({
				title: `Chọn mã giấy phép nhập khẩu (${rowIndex + 1})`,
				description: "Tra cứu mã giấy phép nhập khẩu kèm diễn giải.",
				emptyMessage: "Không có mã giấy phép phù hợp.",
				options,
				selectedValue: code || null,
				selectedOptionId:
					options.find((option) => option.value === code)?.id ?? null,
				onSelect: (option) => {
					preserveActiveTabScroll(() => {
						updateImportLicenseSlot(
							rowIndex,
							buildImportLicenseSlotEntry(option.value, number),
						);
						setLookupDialogState(null);
					});
					toast.success("Đã nạp mã giấy phép nhập khẩu.");
				},
			});
		},
		[
			data.importLicenses,
			getImportLicenseSlotLockReason,
			getLookupOptionsForField,
			openCollectionLookupDialog,
			preserveActiveTabScroll,
			setLookupDialogState,
			updateImportLicenseSlot,
		],
	);

	const handleOpenLegalDocumentCodeLookup = useCallback(
		(rowIndex: number) => {
			const rowLockReason = getLegalDocumentSlotLockReason(rowIndex);
			if (rowLockReason) {
				toast.info(rowLockReason);
				return;
			}

			const options = buildLookupDialogOptions(
				"otherLegalDocumentCode",
				getLookupOptionsForField("otherLegalDocumentCode"),
			);

			if (options.length === 0) {
				toast.info("Chưa có danh mục mã văn bản pháp quy");
				return;
			}

			const currentValue =
				Array.isArray(data.otherLegalDocumentCodes) &&
				typeof data.otherLegalDocumentCodes[rowIndex] === "string"
					? data.otherLegalDocumentCodes[rowIndex]
					: null;

			openCollectionLookupDialog({
				title: `Chọn mã văn bản pháp quy (${rowIndex + 1})`,
				description: "Tra cứu mã văn bản pháp quy kèm diễn giải.",
				emptyMessage: "Không có mã văn bản pháp quy phù hợp.",
				options,
				selectedValue: currentValue,
				selectedOptionId:
					options.find((option) => option.value === currentValue)?.id ?? null,
				onSelect: (option) => {
					preserveActiveTabScroll(() => {
						updateLegalDocumentSlot(rowIndex, option.value);
						setLookupDialogState(null);
					});
					toast.success("Đã nạp mã văn bản pháp quy.");
				},
			});
		},
		[
			data.otherLegalDocumentCodes,
			getLegalDocumentSlotLockReason,
			getLookupOptionsForField,
			openCollectionLookupDialog,
			preserveActiveTabScroll,
			setLookupDialogState,
			updateLegalDocumentSlot,
		],
	);

	const handleOpenElectronicAttachmentTypeLookup = useCallback(
		(rowIndex: number) => {
			const rowLockReason = getElectronicAttachmentLockReason(rowIndex);
			if (rowLockReason) {
				toast.info(rowLockReason);
				return;
			}

			const options = CDS_ELECTRONIC_ATTACHMENT_TYPE_OPTIONS.map(
				(option, index) => ({
					id: `attachment-type-${option.value}-${index}`,
					value: option.value,
					label: option.label,
					description: option.label.startsWith(`${option.value} - `)
						? option.label.slice(`${option.value} - `.length).trim()
						: option.label,
					searchText: `${option.value} ${option.label}`.toLowerCase(),
				}),
			);

			const currentValue =
				Array.isArray(data.electronicAttachments) &&
				data.electronicAttachments[rowIndex]?.attachmentDescription
					? String(data.electronicAttachments[rowIndex]?.attachmentDescription)
							.trim()
							.toUpperCase()
					: null;

			openCollectionLookupDialog({
				title: `Chọn loại đính kèm (${rowIndex + 1})`,
				description: "Tra cứu mã loại đính kèm điện tử kèm diễn giải.",
				emptyMessage: "Không có loại đính kèm phù hợp.",
				options,
				selectedValue: currentValue,
				selectedOptionId:
					options.find((option) => option.value === currentValue)?.id ?? null,
				onSelect: (option) => {
					preserveActiveTabScroll(() => {
						updateElectronicAttachment(
							rowIndex,
							"attachmentDescription",
							option.value,
						);
						setLookupDialogState(null);
					});
					toast.success("Đã nạp loại đính kèm.");
				},
			});
		},
		[
			data.electronicAttachments,
			getElectronicAttachmentLockReason,
			openCollectionLookupDialog,
			preserveActiveTabScroll,
			setLookupDialogState,
			updateElectronicAttachment,
		],
	);

	const hanCandidateRows = useMemo(
		() =>
			showHanCandidateDialog
				? hanCandidates.map((candidate) => ({
						...candidate,
						comparisonSummary: buildHanCandidateComparisonSummary(
							deferredValidationData,
							candidate,
						),
					}))
				: [],
		[deferredValidationData, hanCandidates, showHanCandidateDialog],
	);

	const selectedHanCandidate = useMemo(
		() =>
			hanCandidateRows.find(
				(candidate) =>
					String(candidate.declarationId) === selectedHanCandidateId,
			) ?? null,
		[hanCandidateRows, selectedHanCandidateId],
	);

	const handleRegisterSelectedHanCandidate = useCallback(async () => {
		if (!selectedHanCandidate) {
			return;
		}
		if (!canTransmitToHan) {
			toast.error("Chưa thể truyền qua app", {
				description: hanConnectionUnavailableMessage,
			});
			return;
		}

		const result = await executeRegisterDeclaration({
			declarationId: selectedHanCandidate.declarationId,
		});

		if (result) {
			setShowHanCandidateDialog(false);
		}
	}, [
		canTransmitToHan,
		executeRegisterDeclaration,
		hanConnectionUnavailableMessage,
		selectedHanCandidate,
		setShowHanCandidateDialog,
	]);

	const filteredLookupDialogOptions = useMemo(() => {
		if (!lookupDialogState) {
			return [];
		}

		const query = lookupDialogQuery.trim().toLowerCase();
		if (!query) {
			return lookupDialogState.options;
		}

		const normalizedQuery = normalizeLookupSearchText(lookupDialogQuery);
		const scoredMatches = lookupDialogState.options
			.map((option) => {
				const normalizedValue = normalizeLookupSearchText(option.value);
				const normalizedLabel = normalizeLookupSearchText(option.label);
				const normalizedDescription = normalizeLookupSearchText(
					option.description ?? "",
				);
				const normalizedOptionText = normalizeLookupSearchText(
					`${option.value} ${option.label} ${option.description ?? ""}`,
				);

				let score = -1;
				if (normalizedQuery) {
					if (normalizedValue.startsWith(normalizedQuery)) {
						score = 100;
					} else if (normalizedValue.includes(normalizedQuery)) {
						score = 80;
					} else if (normalizedLabel.startsWith(normalizedQuery)) {
						score = 60;
					} else if (
						normalizedLabel.includes(normalizedQuery) ||
						normalizedDescription.includes(normalizedQuery) ||
						normalizedOptionText.includes(normalizedQuery)
					) {
						score = 40;
					}
				} else if (option.searchText.includes(query)) {
					score = 10;
				}

				if (
					score < 0 &&
					query &&
					option.searchText.toLowerCase().includes(query)
				) {
					score = 20;
				}

				return { option, score };
			})
			.filter((item) => item.score >= 0)
			.sort(
				(left, right) =>
					right.score - left.score ||
					left.option.value.localeCompare(right.option.value),
			);

		return scoredMatches.map((item) => item.option);
	}, [lookupDialogQuery, lookupDialogState]);

	const handleLookupDialogOptionSelect = useCallback(
		(option: LookupDialogOption) => {
			lookupDialogState?.onSelect(option);
			focusNextFromCdsFocusAnchor();
		},
		[lookupDialogState],
	);

	const handleAiConflictValueSelect = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow, value: unknown) => {
			const { disabledReason, isDisabled } = resolveFieldLockState(fieldKey);
			if (isDisabled) {
				toast.info(disabledReason ?? "Trường này đang khóa.");
				return;
			}

			const review = aiFieldReviewMap[fieldKey];
			if (review && shouldShowCdsAiFieldReview(review)) {
				setAiReviewedFieldMap((current) => ({
					...current,
					[fieldKey]: {
						signature: getCdsAiFieldReviewSignature(review),
						selectedComparableValue: normalizeCdsAiComparableValue(value),
					},
				}));
			}

			handleFieldChange(fieldKey, value);
		},
		[aiFieldReviewMap, handleFieldChange, resolveFieldLockState],
	);

	const renderAiAnnotatedField = (
		fieldKey: keyof FollowUpCdsInfoRow,
		content: ReactNode,
	) => (
		<CdsAiConflictPicker
			fieldKey={fieldKey}
			operationType={resolvedOperationType}
			review={aiFieldReviewMap[fieldKey]}
			isReviewed={isCdsAiFieldReviewResolved(
				aiFieldReviewMap[fieldKey],
				aiReviewedFieldMap[fieldKey],
			)}
			onSelect={handleAiConflictValueSelect}
		>
			{content}
		</CdsAiConflictPicker>
	);

	const renderInput = (field: FieldConfig) => {
		const fieldKey = field.key as keyof FollowUpCdsInfoRow;
		const hasLookup = getLookupOptionsForField(fieldKey).length > 0;

		if (field.type === "select") {
			return renderClassicSelect(fieldKey);
		}

		if (field.type === "date") {
			return renderClassicDateInput(fieldKey);
		}

		if (field.type === "textarea") {
			const { disabledReason, isDisabled } = resolveFieldLockState(fieldKey);

			return renderAiAnnotatedField(
				fieldKey,
				<BufferedTextarea
					value={String(data[fieldKey] ?? "")}
					onCommit={(nextValue) => handleFieldChange(fieldKey, nextValue)}
					disabled={isDisabled}
					title={disabledReason ?? undefined}
					suppressManualScrollRestore={suppressManualScrollRestore}
					rows={field.rows || 3}
					placeholder={field.placeholder}
					className={cn(ecusClassicInputCls, "min-h-[60px] resize-none py-1")}
				/>,
			);
		}

		if (hasLookup) {
			return renderClassicCodeLookupSelect(fieldKey, {
				showButton: true,
			});
		}

		return renderClassicInput(fieldKey, undefined, field.placeholder);
	};

	useEffect(() => {
		if (!suggestedProcessingDepartment) {
			return;
		}

		preserveActiveTabScroll(() => {
			setData((prev) => {
				const currentValue =
					prev.declarationProcessingDeptCode === null ||
					prev.declarationProcessingDeptCode === undefined
						? ""
						: String(prev.declarationProcessingDeptCode).trim();

				if (currentValue) {
					return prev;
				}

				return {
					...prev,
					declarationProcessingDeptCode: suggestedProcessingDepartment.code,
				};
			});
		});
	}, [preserveActiveTabScroll, suggestedProcessingDepartment, setData]);

	const resolvedGetLookupDescription = useCallback(
		(fieldKey: keyof FollowUpCdsInfoRow) =>
			getLookupDescription(fieldKey, data, getLookupOptionsForField),
		[data, getLookupOptionsForField],
	);

	const commonUiProps = {
		data,
		handleFieldChange,
		suppressManualScrollRestore,
		getLookupOptionsForField,
		getInitialEntryLockReason,
		usesManualLookupPicker,
		openLookupDialogForField,
		resolveFieldLockState,
		getLookupDescription: resolvedGetLookupDescription,
		ecusInputCls,
		ecusSelectCls,
		ecusTextareaCls,
		ecusDisabledFieldCls,
		ecusDisabledButtonCls,
		ecusClassicInputCls,
		ecusClassicSelectCls,
		ecusClassicReadonlyCls,
		ecusClassicButtonCls,
	};

	const renderClassicLabel = (label: string, required = false) => (
		<ClassicLabel label={label} required={required} />
	);

	const renderClassicSectionHeader = (title: string) => (
		<ClassicSectionHeader title={title} />
	);

	const renderClassicDateInput = (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
	) =>
		renderAiAnnotatedField(
			fieldKey,
			<ClassicDateInput
				fieldKey={fieldKey}
				className={className}
				{...commonUiProps}
			/>,
		);

	const renderClassicSelect = (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
		lockOptions?: FieldRenderLockOptions,
	) =>
		renderAiAnnotatedField(
			fieldKey,
			<ClassicSelect
				fieldKey={fieldKey}
				className={className}
				lockOptions={lockOptions}
				displayMode={
					CLASSIC_CODE_ONLY_SELECT_FIELDS.has(fieldKey)
						? "code-only"
						: "code-and-description"
				}
				{...commonUiProps}
			/>,
		);

	const renderClassicInput = (
		fieldKey: keyof FollowUpCdsInfoRow,
		className?: string,
		placeholder?: string,
		lockOptions?: FieldRenderLockOptions,
	) =>
		renderAiAnnotatedField(
			fieldKey,
			<ClassicInput
				fieldKey={fieldKey}
				className={className}
				placeholder={placeholder}
				lockOptions={lockOptions}
				maxLength={
					isCdsPartnerAddressField(fieldKey)
						? CDS_PARTNER_ADDRESS_LINE_MAX_LENGTH
						: undefined
				}
				{...commonUiProps}
			/>,
		);

	const renderClassicReadonlyInput = (
		value: string | null | undefined,
		className?: string,
	) => (
		<ClassicReadonlyInput
			value={String(value ?? "")}
			className={className}
			ecusClassicReadonlyCls={ecusClassicReadonlyCls}
		/>
	);

	const renderClassicCodeLookupSelect = (
		fieldKey: keyof FollowUpCdsInfoRow,
		options?: {
			codeWidthClassName?: string;
			selectClassName?: string;
			wrapperClassName?: string;
			showButton?: boolean;
			lockOptions?: FieldRenderLockOptions;
		},
	) =>
		renderAiAnnotatedField(
			fieldKey,
			<ClassicCodeLookupSelect
				fieldKey={fieldKey}
				codeWidthClassName={options?.codeWidthClassName}
				selectClassName={options?.selectClassName}
				wrapperClassName={options?.wrapperClassName}
				showButton={options?.showButton}
				lockOptions={options?.lockOptions}
				{...commonUiProps}
			/>,
		);

	const renderLookupCodeAndName = (
		fieldKey: keyof FollowUpCdsInfoRow,
		displayField?: keyof FollowUpCdsInfoRow,
		options?: {
			codeWidthClassName?: string;
			buttonLabel?: string;
			hideButton?: boolean;
			namePlaceholder?: string;
		},
	) =>
		renderAiAnnotatedField(
			fieldKey,
			<ClassicLookupCodeAndName
				fieldKey={fieldKey}
				displayField={displayField}
				codeWidthClassName={options?.codeWidthClassName}
				buttonLabel={options?.buttonLabel}
				hideButton={options?.hideButton}
				namePlaceholder={options?.namePlaceholder}
				{...commonUiProps}
			/>,
		);

	const renderLookupPickerButton = (
		fieldKey: keyof FollowUpCdsInfoRow,
		options?: {
			buttonLabel?: string;
			className?: string;
			displayField?: keyof FollowUpCdsInfoRow;
			lockOptions?: FieldRenderLockOptions;
		},
	) => (
		<ClassicLookupPickerButton
			fieldKey={fieldKey}
			buttonLabel={options?.buttonLabel}
			className={options?.className}
			displayField={options?.displayField}
			lockOptions={options?.lockOptions}
			{...commonUiProps}
		/>
	);

	const showExportLicenseTable = resolvedOperationType === "XUAT";
	const showLicenseFields = resolvedOperationType === "NHAP";
	const showLegalDocumentFields = resolvedOperationType === "NHAP";
	const resolvedBusinessTypeGroup = resolveCdsBusinessTypeGroup(
		data.businessTypeGroup,
		data.operationCode,
	);
	const commonTableProps = {
		data,
		ecusTableInputCls,
		ecusBillTableInputCls,
		ecusDisabledFieldCls,
		importLicenseOptions: getLookupOptionsForField("importLicense"),
		legalDocumentOptions: getLookupOptionsForField("otherLegalDocumentCode"),
		electronicAttachmentTypeOptions: CDS_ELECTRONIC_ATTACHMENT_TYPE_OPTIONS,
		renderClassicLabel,
		getBillItemRowLockReason,
		updateBillItem: updateBillItemWithScroll,
		getValuationAdjustmentLockReason,
		updateValuationAdjustment: updateValuationAdjustmentWithScroll,
		getElectronicAttachmentLockReason,
		updateElectronicAttachment: updateElectronicAttachmentWithScroll,
		handleOpenElectronicAttachmentTypeLookup,
		handleOpenElectronicAttachmentLookup,
		handleUploadElectronicAttachment,
		uploadingAttachmentIndex,
		getTransportScheduleLockReason,
		updateTransportSchedule: updateTransportScheduleWithScroll,
		handleOpenTransportLocationLookup,
		showExportLicenseTable,
		getExportLicenseRowLockReason,
		updateImportLicenseSlot: updateImportLicenseSlotWithScroll,
		handleOpenImportLicenseTypeLookup,
		updateLegalDocumentSlot: updateLegalDocumentSlotWithScroll,
		handleOpenLegalDocumentCodeLookup,
		handleOpenExportPermitLookup,
		showLicenseFields,
		getImportLicenseSlotLockReason,
		showLegalDocumentFields,
		getLegalDocumentSlotLockReason,
		suppressManualScrollRestore,
	};

	const valuationAllocationRatioTotal = useMemo(() => {
		if (!Array.isArray(data.valuationAdjustments)) {
			return "";
		}

		const total = data.valuationAdjustments.reduce((sum, item) => {
			const normalizedValue = normalizeLooseNumber(item?.allocationRatio);
			return normalizedValue === null ? sum : sum + normalizedValue;
		}, 0);

		return total > 0 ? String(total) : "";
	}, [data.valuationAdjustments]);

	const renderInfoButton = (
		message: string,
		options?: {
			buttonLabel?: string;
			className?: string;
			icon?: ReactNode;
			ariaLabel?: string;
		},
	) => {
		const accessibleLabel =
			options?.ariaLabel ?? options?.buttonLabel ?? message;

		return (
			<button
				type="button"
				disabled
				aria-label={accessibleLabel}
				title={message}
				className={cn(
					ecusClassicButtonCls,
					ecusDisabledButtonCls,
					options?.className,
				)}
			>
				{options?.icon ?? options?.buttonLabel ?? "..."}
			</button>
		);
	};

	const renderExportSectionHeader = (title: string) => (
		<div className="mt-[10px] mb-[4px] flex w-full items-center gap-1 px-[6px] sm:px-[8px]">
			<span className="whitespace-nowrap text-[12px] font-bold text-[#6a2717]">
				{title}
			</span>
			<div className="mt-px h-px flex-1 bg-[#c8c8c8]" />
		</div>
	);

	/* ══════════════════════════════════════════════════════
     ECUS-style Container Grid (50 slots) — matches image 100%
     ══════════════════════════════════════════════════════ */

	const tabProps: import("./tabs/cds-tab-props").CdsTabRenderProps = {
		data,
		handleFieldChange,
		suppressManualScrollRestore,
		renderClassicLabel,
		renderClassicSectionHeader,
		renderClassicDateInput,
		renderClassicSelect,
		renderClassicInput,
		renderClassicReadonlyInput,
		renderClassicCodeLookupSelect,
		renderLookupCodeAndName,
		renderLookupPickerButton,
		renderInfoButton,
		renderExportSectionHeader,
		getImportImage1FieldLockOptions,
		getExportFieldLockOptions,
		resolvedGetLookupDescription,
		valuationAllocationRatioTotal,
		commonTableProps,
	};

	const [isModalOpen, setIsModalOpen] = useState(false);

	const modalContent = isLoading ? (
		<div className="flex h-full items-center justify-center bg-white">
			<div className="flex items-center gap-3">
				<div className="size-5 animate-spin rounded-full border-2 border-[#315d8f] border-t-transparent" />
				<span className="text-[14px] font-medium text-slate-600">
					Đang tải dữ liệu...
				</span>
			</div>
		</div>
	) : (
		<div
			ref={cdsPanelBodyRef}
			data-no-drag-scroll
			className="relative flex h-full flex-col overflow-hidden bg-white"
			style={{
				fontFamily: "Tahoma, Arial, sans-serif",
				fontSize: "12px",
			}}
		>
			<Dialog
				open={lookupDialogState !== null}
				onOpenChange={(open) => {
					if (!open) {
						preserveActiveTabScroll(() => {
							setLookupDialogState(null);
						});
					}
				}}
			>
				<DialogContent
					finalFocus={false}
					className={cn(
						lookupDialogState?.variant === "location-table"
							? "max-w-5xl"
							: "max-w-3xl",
					)}
				>
					<DialogHeader>
						<DialogTitle>
							{lookupDialogState?.title ?? "Chọn dữ liệu"}
						</DialogTitle>
						<DialogDescription>
							{lookupDialogState?.description ??
								"Chọn một giá trị để nạp vào form."}
						</DialogDescription>
					</DialogHeader>

					<Input
						value={lookupDialogQuery}
						onChange={(event) => setLookupDialogQuery(event.target.value)}
						placeholder={
							lookupDialogState?.searchPlaceholder ??
							"Tìm theo mã hoặc mô tả..."
						}
						className="h-9"
					/>

					{lookupDialogState?.variant === "location-table" ? (
						<div className="max-h-[420px] overflow-y-auto rounded border border-slate-300 bg-white">
							{filteredLookupDialogOptions.length === 0 ? (
								<div className="px-3 py-4 text-sm text-slate-500">
									{lookupDialogState?.emptyMessage ??
										"Không có dữ liệu phù hợp."}
								</div>
							) : (
								<table className="w-full border-collapse text-[12px]">
									<thead className="sticky top-0 bg-[#d9d9d9] text-slate-900">
										<tr>
											<th className="w-[56px] border-b border-r border-slate-300 px-2 py-1 text-right font-semibold">
												STT
											</th>
											<th className="w-[140px] border-b border-r border-slate-300 px-2 py-1 text-left font-semibold">
												Mã
											</th>
											<th className="border-b border-r border-slate-300 px-2 py-1 text-left font-semibold">
												Địa điểm
											</th>
											<th className="w-[320px] border-b border-r border-slate-300 px-2 py-1 text-left font-semibold">
												Địa chỉ
											</th>
											<th className="w-[72px] border-b border-slate-300 px-2 py-1 text-right font-semibold">
												Dùng
											</th>
										</tr>
									</thead>
									<tbody>
										{filteredLookupDialogOptions.map((option, index) => {
											const isSelected =
												option.id === lookupDialogState?.selectedOptionId ||
												option.value === lookupDialogState?.selectedValue;
											const placeName =
												option.description ||
												getLookupOptionDescription({
													value: option.value,
													label: option.label,
												}) ||
												option.value;
											const note =
												option.meta?.address?.trim() ||
												option.meta?.note?.trim() ||
												"";
											const usedCount = option.meta?.usedCount?.trim() || "";

											return (
												<tr
													key={option.id}
													tabIndex={0}
													onClick={(event) => {
														stopCdsInteraction(event);
														handleLookupDialogOptionSelect(option);
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															stopCdsInteraction(event);
															handleLookupDialogOptionSelect(option);
														}
													}}
													className={cn(
														"cursor-pointer border-b border-slate-200 last:border-b-0",
														isSelected ? "bg-[#cfe8ff]" : "hover:bg-slate-50",
													)}
												>
													<td className="border-r border-slate-200 px-2 py-1.5 text-right text-slate-600">
														{index + 1}
													</td>
													<td className="border-r border-slate-200 px-2 py-1.5 font-medium text-slate-900">
														{option.value}
													</td>
													<td className="border-r border-slate-200 px-2 py-1.5 text-slate-800">
														{placeName}
													</td>
													<td className="border-r border-slate-200 px-2 py-1.5 text-slate-600">
														{note || ""}
													</td>
													<td className="px-2 py-1.5 text-right text-slate-600">
														{usedCount}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</div>
					) : (
						<div className="max-h-[420px] space-y-2 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2">
							{filteredLookupDialogOptions.length === 0 ? (
								<div className="rounded bg-white px-3 py-4 text-sm text-slate-500">
									{lookupDialogState?.emptyMessage ??
										"Không có dữ liệu phù hợp."}
								</div>
							) : (
								filteredLookupDialogOptions.map((option) => {
									const isSelected =
										option.id === lookupDialogState?.selectedOptionId ||
										option.value === lookupDialogState?.selectedValue;
									const summary =
										option.description ||
										getLookupOptionDescription({
											value: option.value,
											label: option.label,
										}) ||
										option.value;

									return (
										<button
											key={option.id}
											type="button"
											onClick={(event) => {
												stopCdsInteraction(event);
												handleLookupDialogOptionSelect(option);
											}}
											className={cn(
												"w-full rounded border px-3 py-2 text-left transition-colors",
												isSelected
													? "border-blue-500 bg-blue-50"
													: "border-slate-200 bg-white hover:bg-slate-100",
											)}
										>
											<div className="text-[12px] font-semibold text-slate-900">
												{option.value}
											</div>
											<div className="text-[12px] text-slate-700">
												{summary}
											</div>
										</button>
									);
								})
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={showHanCandidateDialog}
				onOpenChange={setShowHanCandidateDialog}
			>
				<DialogContent className="max-w-6xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-slate-900">
							<Download className="size-5" />
							Chọn tờ khai nhập mới từ data của người dùng
						</DialogTitle>
						<DialogDescription className="text-sm text-slate-600 pt-2">
							{followUpSummary?.taxCode || taxCode ? (
								<span>
									Lọc theo MST{" "}
									<strong>{followUpSummary?.taxCode || taxCode}</strong>. Chọn
									một bản ghi nhập mới để đối chiếu, sau đó bấm{" "}
									<strong>Truyền qua VNACC</strong> để cập nhật trực tiếp vào
									data của người dùng.
								</span>
							) : (
								<span>
									Chọn một bản ghi nhập mới để đối chiếu, rồi ghi trực tiếp vào
									data của người dùng khi cần.
								</span>
							)}
						</DialogDescription>
					</DialogHeader>

					{hanCandidatesError && (
						<div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
							{hanCandidatesError}
						</div>
					)}

					{hanCandidatesLoading ? (
						<div className="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
							<div className="size-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
							Đang tải danh sách tờ khai từ data của người dùng...
						</div>
					) : hanCandidateRows.length === 0 ? (
						<div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
							Không tìm thấy tờ khai nhập mới phù hợp với điều kiện hiện tại.
						</div>
					) : (
						<div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
							<div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
								{hanCandidateRows.map((candidate) => {
									const isSelected =
										String(candidate.declarationId) ===
										String(selectedHanCandidate?.declarationId ?? "");

									return (
										<button
											key={candidate.declarationId}
											type="button"
											onClick={() =>
												setSelectedHanCandidateId(
													String(candidate.declarationId),
												)
											}
											className={cn(
												"w-full rounded border px-3 py-2 text-left transition-colors",
												isSelected
													? "border-blue-500 bg-blue-50"
													: "border-slate-200 bg-white hover:bg-slate-50",
											)}
										>
											<div className="flex items-center justify-between gap-2">
												<div className="text-[12px] font-bold text-slate-900">
													{candidate.declarationNumber ||
														`#${candidate.declarationId}`}
												</div>
												<div className="text-[11px] text-slate-500">
													{candidate.declarationDate
														? new Date(
																candidate.declarationDate,
															).toLocaleDateString("vi-VN")
														: "Chưa có ngày"}
												</div>
											</div>
											<div className="mt-1 text-[11px] text-slate-600">
												{candidate.companyName || "Không có tên doanh nghiệp"}
											</div>
											<div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-600">
												<span className="rounded bg-slate-100 px-1.5 py-0.5">
													TTTK: {candidate.statusFlags.tttk || "-"}
												</span>
												<span className="rounded bg-slate-100 px-1.5 py-0.5">
													X/N: {candidate.statusFlags.xOrN || "-"}
												</span>
												<span className="rounded bg-slate-100 px-1.5 py-0.5">
													Lệch:{" "}
													{candidate.comparisonSummary.totalDifferentFields}
												</span>
											</div>
										</button>
									);
								})}
							</div>

							<div className="rounded border border-slate-200 bg-slate-50 p-3">
								<div className="space-y-3">
									{selectedHanCandidate ? (
										<>
											<div className="grid gap-2 text-[12px] text-slate-700 sm:grid-cols-2">
												<div>
													<div className="text-slate-500">Số tờ khai</div>
													<div className="font-bold text-slate-900">
														{selectedHanCandidate.declarationNumber || "—"}
													</div>
												</div>
												<div>
													<div className="text-slate-500">MST</div>
													<div className="font-bold text-slate-900">
														{selectedHanCandidate.taxCode || "—"}
													</div>
												</div>
												<div>
													<div className="text-slate-500">Doanh nghiệp</div>
													<div className="font-bold text-slate-900">
														{selectedHanCandidate.companyName || "—"}
													</div>
												</div>
												<div>
													<div className="text-slate-500">Mã loại hình</div>
													<div className="font-bold text-slate-900">
														{selectedHanCandidate.operationCode || "—"}
													</div>
												</div>
											</div>

											<div className="rounded border border-slate-200 bg-white p-3">
												<div className="mb-2 text-[12px] font-bold text-slate-800">
													So sánh đầy đủ
												</div>
												{selectedHanCandidate.comparisonSummary.diffs.length >
												0 ? (
													<>
														<div className="mb-2 text-[11px] text-slate-500">
															{selectedHanCandidate.comparisonSummary
																.totalDifferentFields === 1
																? "Có 1 trường khác nhau giữa dữ liệu hiện tại và data của người dùng."
																: `Có ${selectedHanCandidate.comparisonSummary.totalDifferentFields} trường khác nhau giữa dữ liệu hiện tại và data của người dùng.`}
														</div>
														<div className="max-h-[360px] space-y-1 overflow-y-auto pr-1 text-[11px] text-slate-700">
															{selectedHanCandidate.comparisonSummary.diffs.map(
																(diff) => (
																	<div
																		key={diff.field}
																		className="grid grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-slate-100 pb-1 last:border-b-0 last:pb-0"
																	>
																		<div className="font-medium text-slate-600">
																			{diff.label}
																		</div>
																		<div className="truncate text-rose-700">
																			Hiện tại: {diff.currentValue || "—"}
																		</div>
																		<div className="truncate text-emerald-700">
																			Data người dùng:{" "}
																			{diff.candidateValue || "—"}
																		</div>
																	</div>
																),
															)}
														</div>
													</>
												) : (
													<div className="text-[11px] text-slate-500">
														Bản chọn không khác dữ liệu hiện tại ở các trường so
														sánh chính.
													</div>
												)}
											</div>
										</>
									) : (
										<div className="rounded border border-dashed border-slate-300 bg-white px-3 py-10 text-center text-sm text-slate-600">
											Chưa chọn dữ liệu người dùng. Hãy chọn một bản ghi ở danh
											sách bên trái để xem đối chiếu và bật thao tác ghi.
										</div>
									)}

									<div className="flex items-center justify-end gap-2">
										<div className="mr-auto text-[11px] text-slate-500">
											Luồng này dùng để đối chiếu bản ghi “nhập mới” trên data
											của người dùng trước khi cập nhật trực tiếp từ CDS web.
										</div>
										<Button
											size="sm"
											onClick={handleRegisterSelectedHanCandidate}
											disabled={
												!selectedHanCandidate ||
												isRegistering ||
												!canTransmitToHan
											}
											className="h-7 rounded-none bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-700"
											title={transmitButtonTitle}
										>
											<Send className="mr-1 size-3" />
											{isRegistering ? "Đang truyền..." : "Truyền qua VNACC"}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setShowHanCandidateDialog(false)}
											className="h-7 rounded-none border-[#ccc] px-3 text-[11px]"
										>
											Đóng
										</Button>
									</div>
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
			{/* ── Confirmation Dialog ── */}
			<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-amber-700">
							<AlertTriangle className="size-5" />
							Xác nhận truyền qua VNACC
						</DialogTitle>
						<div className="pt-2 space-y-2 text-sm text-slate-600">
							<div>
								{data.ecusDeclarationId ? (
									<>
										Hành động này sẽ <strong>cập nhật đè</strong> lên tờ khai
										trong data của người dùng đang liên kết với follow-up này.
										{` `}
										Dữ liệu CDS hiện tại sẽ được truyền lại sang app xuất nhập
										khẩu và hệ thống sẽ đọc lại bản ghi vừa cập nhật để verify.
									</>
								) : (
									<>
										Hành động này sẽ <strong>tạo tờ khai mới</strong> trên data
										của người dùng. Dữ liệu CDS hiện tại sẽ được truyền sang app
										xuất nhập khẩu và hệ thống sẽ đọc lại bản ghi vừa ghi để
										verify.
									</>
								)}
							</div>
							{data.ecusDeclarationId ? (
								<div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
									Đang dùng lại declaration ID{" "}
									<strong>{data.ecusDeclarationId}</strong>. Bấm truyền lại sẽ
									cập nhật bản ghi này thay vì tạo thêm tờ khai mới.
								</div>
							) : null}
							{hanConnection ? (
								<div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
									Data người dùng: <strong>{hanConnectionCatalogLabel}</strong>{" "}
									· Site: <strong>{hanConnectionSiteLabel}</strong> · Nguồn:{" "}
									<strong>{hanConnectionSourceLabel}</strong>
								</div>
							) : hanConnectionError ? (
								<div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
									{hanConnectionError}
								</div>
							) : null}
							<div className="text-xs text-slate-500">
								Sau khi ghi xong, trạng thái local sẽ chuyển sang{" "}
								<strong>REGISTERED</strong>. Nếu bạn chỉnh sửa lại dữ liệu,
								trạng thái sẽ reset về DRAFT.
							</div>
						</div>
					</DialogHeader>
					<div className="flex items-center justify-end gap-2 pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowConfirmDialog(false)}
							className="h-9"
						>
							Huỷ
						</Button>
						<Button
							size="sm"
							onClick={() => void executeRegisterDeclaration()}
							disabled={isRegistering || !canTransmitToHan}
							className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
							title={transmitButtonTitle}
						>
							<Send className="mr-1.5 size-3.5" />
							{isRegistering
								? "Đang truyền..."
								: data.ecusDeclarationId
									? "Xác nhận cập nhật"
									: "Xác nhận truyền mới"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
			{/* ══════════════════════════════════════════════════════
          Compact command bar kept outside the tab body so the
          "Thông tin chung" area stays close to the ECUS reference.
         ══════════════════════════════════════════════════════ */}
			<div className="flex flex-wrap items-center gap-0.5 border-b border-[#999] bg-[#ececec] px-1 py-0.5">
				<div className="mr-auto flex min-w-0 items-center gap-2 text-[10.5px] text-slate-600">
					{followUpSummary?.jobNumber ? (
						<span className="truncate">Job: {followUpSummary.jobNumber}</span>
					) : null}
					{data.ecusDeclarationId ? (
						<span className="hidden truncate text-slate-500 sm:inline">
							ID: {data.ecusDeclarationId}
						</span>
					) : null}
					{hanConnection ? (
						<span
							className="hidden min-w-0 max-w-[520px] items-center gap-1 truncate text-slate-600 md:inline-flex"
							title={hanConnectionTitle}
						>
							<Database className="size-3 shrink-0 text-slate-500" />
							<span className="truncate">
								Catalog: {hanConnectionCatalogLabel} · Site:{" "}
								{hanConnectionSiteLabel}
							</span>
						</span>
					) : hanConnectionError ? (
						<span
							className="hidden truncate text-amber-700 md:inline"
							title={hanConnectionError}
						>
							Catalog: chưa cấu hình · Site: —
						</span>
					) : null}
					{canExportDeclaration ? (
						<span
							className={cn(
								"hidden truncate sm:inline",
								blockingValidationIssues.length > 0
									? "text-rose-700"
									: warningValidationIssues.length > 0
										? "text-amber-700"
										: "text-emerald-700",
							)}
						>
							{validationSummaryLabel}
						</span>
					) : null}
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => void fetchData()}
					disabled={isLoading}
					className="h-7 w-7 rounded-none p-0 sm:h-5 sm:w-5"
					title="Refresh dữ liệu"
				>
					<RefreshCw
						className={cn("size-3 text-slate-600", isLoading && "animate-spin")}
					/>
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={handleReloadLookups}
					disabled={isLookupLoading}
					className="h-7 rounded-none border-[#aaa] px-2 text-[11px] font-medium sm:h-5 sm:px-1.5 sm:text-[10.5px]"
				>
					Lookup
				</Button>
				{resolvedOperationType === "XUAT" && (
					<Button
						variant="outline"
						size="sm"
						onClick={handleOpenHanCandidates}
						disabled={isLoading || isSaving || isRegistering || isSyncingCargo}
						className="hidden h-7 rounded-none border-[#aaa] px-2 text-[11px] font-medium sm:inline-flex sm:h-5 sm:px-1.5 sm:text-[10.5px]"
						title="Đối chiếu bản ghi nhập mới từ data của người dùng"
					>
						Đối chiếu
					</Button>
				)}
				{canExportDeclaration ? (
					<Button
						variant="outline"
						size="sm"
						onClick={handleOpenValidationPanel}
						className={cn(
							"h-7 rounded-none border px-2 text-[11px] font-medium sm:h-5 sm:px-1.5 sm:text-[10.5px]",
							blockingValidationIssues.length > 0
								? "border-rose-300 text-rose-700"
								: warningValidationIssues.length > 0
									? "border-amber-300 text-amber-700"
									: "border-emerald-300 text-emerald-700",
						)}
						title="Kiểm tra dữ liệu trước khi truyền qua VNACC"
					>
						<ClipboardList className="mr-1 size-3" />
						Kiểm tra
					</Button>
				) : null}
				{canExportDeclaration && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => void handleExportDeclaration()}
						disabled={
							isLoading ||
							isSaving ||
							isRegistering ||
							isExporting ||
							isSyncingCargo
						}
						className="h-7 rounded-none border-[#aaa] px-2 text-[11px] font-medium sm:h-5 sm:px-1.5 sm:text-[10.5px]"
						title={exportDeclarationTitle}
					>
						<Download className="mr-1 size-3" />
						{isExporting ? "Đang xuất..." : "Xuất Excel"}
					</Button>
				)}
				<Button
					size="sm"
					onClick={() => void handleSaveWithCargoSync()}
					disabled={
						isSaving ||
						isRegistering ||
						isSyncingCargo ||
						isAppIssuedDeclaration
					}
					className="h-7 rounded-none bg-[#4466cc] px-2 text-[11px] font-bold text-white hover:bg-[#3355bb] sm:h-5 sm:px-1.5 sm:text-[10.5px]"
					title={
						isAppIssuedDeclaration
							? (appIssuedDeclarationLockReason ?? undefined)
							: "Lưu thông tin CDS"
					}
				>
					{isSaving ? "Đang lưu..." : "Lưu"}
				</Button>
				{isAppIssuedDeclaration ? (
					<Button
						size="sm"
						variant="outline"
						onClick={() => void handleSyncAppDeclaration()}
						disabled={isSyncingAppDeclaration}
						className="h-7 rounded-none border-[#aaa] px-2 text-[11px] font-medium sm:h-5 sm:px-1.5 sm:text-[10.5px]"
						title="Lấy dữ liệu mới nhất từ data của người dùng theo số tờ khai"
					>
						<RefreshCw
							className={cn(
								"mr-1 size-3",
								isSyncingAppDeclaration && "animate-spin",
							)}
						/>
						{isSyncingAppDeclaration
							? "Đang đồng bộ..."
							: "Đồng bộ data người dùng"}
					</Button>
				) : null}
				<Button
					size="sm"
					onClick={() => void handlePreflightRegister()}
					disabled={
						isRegistering || isSaving || isSyncingCargo || !canTransmitToHan
					}
					className={cn(
						"h-7 rounded-none px-2 text-[11px] font-bold text-white sm:h-5 sm:px-1.5 sm:text-[10.5px]",
						isSubmitted
							? "bg-amber-600 hover:bg-amber-700"
							: "bg-emerald-600 hover:bg-emerald-700",
					)}
					title={transmitButtonTitle}
				>
					{isRegistering ? "Đang truyền..." : "Truyền qua VNACC"}
				</Button>
			</div>
			{canExportDeclaration ? (
				<div className="border-b border-[#b9b9b9] bg-[#f7f7f7]">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 text-[10.5px]">
						<span className="font-semibold text-slate-700">
							Kiểm tra trước khi truyền:
						</span>
						<span
							className={cn(
								"font-medium",
								blockingValidationIssues.length > 0
									? "text-rose-700"
									: "text-emerald-700",
							)}
						>
							{blockingValidationIssues.length > 0
								? `${blockingValidationIssues.length} lỗi bắt buộc`
								: "Không có lỗi bắt buộc"}
						</span>
						<span
							className={cn(
								"font-medium",
								warningValidationIssues.length > 0
									? "text-amber-700"
									: "text-slate-500",
							)}
						>
							{warningValidationIssues.length > 0
								? `${warningValidationIssues.length} cảnh báo`
								: "Không có cảnh báo"}
						</span>
						<button
							type="button"
							onClick={handleOpenValidationPanel}
							className="text-[#3355bb] underline underline-offset-2"
						>
							{showValidationPanel ? "Ẩn chi tiết" : "Xem chi tiết"}
						</button>
					</div>
					{showValidationPanel ? (
						<div className="grid gap-3 border-t border-[#d4d4d4] bg-white px-2 py-2 lg:grid-cols-2">
							<div className="rounded border border-rose-200 bg-rose-50 p-2">
								<div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
									<AlertTriangle className="size-3.5" />
									Lỗi bắt buộc
								</div>
								{blockingValidationIssues.length > 0 ? (
									<div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-[11px] text-rose-900">
										{blockingValidationIssues.map((issue) => (
											<div
												key={`${issue.path}-${issue.message}`}
												className="rounded border border-rose-200 bg-white px-2 py-1"
											>
												<div className="font-medium">{issue.label}</div>
												<div>{issue.message}</div>
											</div>
										))}
									</div>
								) : (
									<div className="text-[11px] text-emerald-700">
										Không có lỗi bắt buộc. Có thể truyền qua VNACC.
									</div>
								)}
							</div>
							<div className="rounded border border-amber-200 bg-amber-50 p-2">
								<div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
									<ClipboardList className="size-3.5" />
									Cảnh báo nên rà soát
								</div>
								{warningValidationIssues.length > 0 ? (
									<div className="max-h-40 space-y-1 overflow-y-auto pr-1 text-[11px] text-amber-900">
										{warningValidationIssues.map((issue) => (
											<div
												key={`${issue.path}-${issue.message}`}
												className="rounded border border-amber-200 bg-white px-2 py-1"
											>
												<div className="font-medium">{issue.label}</div>
												<div>{issue.message}</div>
											</div>
										))}
									</div>
								) : (
									<div className="text-[11px] text-slate-600">
										Không có cảnh báo nào cần rà soát thêm.
									</div>
								)}
							</div>
						</div>
					) : null}
				</div>
			) : null}
			<div className="flex flex-1 min-h-0 overflow-hidden">
				<div className="flex-1 flex flex-col min-w-0 bg-[#efefef]">
					{/* ══════════════════════════════════════════════════════
          ECUS-style Tab Bar (top navigation - giống app ECUS)
         ══════════════════════════════════════════════════════ */}
					<Tabs
						value={resolvedActiveTab}
						onValueChange={setActiveTab}
						className="flex flex-col flex-1 min-h-0 gap-0"
					>
						<div className="cds-visible-x-scrollbar border-b border-[#999] bg-[#f0f0f0]">
							<TabsList className="h-auto w-max min-w-0 flex-wrap justify-start gap-0 rounded-none border-0 bg-transparent p-0 shadow-none">
								{tabConfigs.map((tab, idx) => {
									const tabAiWarningCount =
										aiFieldReviewCountsByTab[tab.id] ?? 0;

									return (
										<TabsTrigger
											key={tab.id}
											value={tab.id}
											className={cn(
												"relative rounded-none border border-b-0 border-[#999] px-2 py-[3px] text-[11px] font-normal -mb-px",
												"data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:border-b-white data-[state=active]:font-semibold data-[state=active]:shadow-none",
												"data-[state=inactive]:bg-[#ececec] data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-[#e4e4e4]",
												idx === 0 ? "ml-0.5" : "",
											)}
										>
											<span>{tab.label}</span>
											{tabAiWarningCount > 0 ? (
												<span
													title={`${tabAiWarningCount} trường AI cần chọn lại`}
													className="ml-1 inline-flex h-[14px] min-w-[14px] items-center justify-center border border-amber-400 bg-amber-100 px-1 text-[8px] font-bold leading-none text-amber-800"
												>
													{tabAiWarningCount}
												</span>
											) : null}
										</TabsTrigger>
									);
								})}
								<div className="ml-auto flex items-center gap-1 pr-1.5">
									{data.ecusDeclarationId ? (
										<span className="hidden font-mono text-[10.5px] text-slate-500 xl:inline">
											ID:{data.ecusDeclarationId}
										</span>
									) : null}
									<button
										type="button"
										onClick={() => void handleReloadLookups()}
										disabled={isLookupLoading}
										title="Làm mới danh mục lookup"
										className="inline-flex h-[20px] w-[20px] items-center justify-center border border-[#9f9f9f] bg-[#ececec] text-[#b97300] hover:bg-[#f7f7f7] disabled:cursor-default disabled:opacity-60"
									>
										<RefreshCw
											className={cn(
												"size-3",
												isLookupLoading && "animate-spin",
											)}
										/>
									</button>
								</div>
							</TabsList>
						</div>

						{error && (
							<div className="mx-2 mt-1 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-[12px] text-red-700">
								{error}
							</div>
						)}

						{isNewCdsDraft && resolvedOperationType && (
							<div className="mx-2 mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">
								Tờ khai mới đang khóa các ô chỉ dùng cho{" "}
								{resolvedOperationType === "NHAP" ? "xuất khẩu" : "nhập khẩu"}{" "}
								để tránh nhập nhầm trong lúc khởi tạo.
							</div>
						)}

						{isAppIssuedDeclaration && appIssuedDeclarationLockReason && (
							<div className="mx-2 mt-1 rounded border border-sky-300 bg-sky-50 px-3 py-1.5 text-[12px] text-sky-800">
								{appIssuedDeclarationLockReason}
							</div>
						)}

						{/* ══════════════════════════════════════════════════════
            Tab Content Panel (ECUS-style white form area)
           ══════════════════════════════════════════════════════ */}
						{(activeTabConfig ? [activeTabConfig] : []).map((tab) => (
							<TabsContent
								key={tab.id}
								value={tab.id}
								className="m-0 mt-0 flex-1 overflow-hidden border-0 bg-[#efefef] p-0 data-[state=inactive]:hidden min-h-0 min-w-0"
							>
								<div
									data-cds-scroll-region="active"
									className={cn(
										"h-full min-h-0 min-w-0 bg-[#efefef] p-0",
										tab.kind === "cargo"
											? "overflow-hidden"
											: "cds-visible-y-scrollbar overflow-x-hidden overscroll-contain",
									)}
								>
									{tab.kind === "cargo" ? (
										<CargoListPanelWithRef
											key={cargoPanelRefreshKey}
											ref={cargoListPanelRef}
											followUpId={followUpId}
											onDataChange={setCargoList}
											operationCode={data.operationCode ?? null}
											variant="cdsInfo"
											readOnly={isAppIssuedDeclaration}
											readOnlyReason={appIssuedDeclarationLockReason}
										/>
									) : tab.id === "ai-document" &&
										resolvedActiveTab === "ai-document" &&
										!isAiChatOpen ? (
										<CdsAiDocumentPanel
											followUpId={followUpId}
											operationType={resolvedOperationType}
											followUpSummary={followUpSummary}
											currentData={data}
											currentCargoList={cargoList}
											handleFieldChange={handleFieldChange}
											onCdsInfoPersisted={handleAiDocumentCdsInfoPersisted}
											onCargoApplied={handleAiDocumentCargoApplied}
											session={cdsAiSession}
										/>
									) : tab.id === "ai-document" ? (
										<div className="h-full bg-[#efefef]" />
									) : tab.kind === "container" ? (
										<CdsContainerGrid
											data={data}
											handleFieldChange={handleFieldChange}
											suppressManualScrollRestore={suppressManualScrollRestore}
											containerGridValues={containerGridValues}
											updateContainerNumber={updateContainerNumberWithScroll}
											handleContainerSlotChange={handleContainerSlotChange}
											handleOpenTruckLoadingLocationLookup={
												handleOpenTruckLoadingLocationLookup
											}
											truckLoadingLocationOptions={getLookupOptionsForField(
												"truckLoadingLocationCode",
											)}
											containerImportFileRef={containerImportFileRef}
											handleContainerExcelImport={handleContainerExcelImport}
											ecusClassicInputCls={ecusClassicInputCls}
											ecusDisabledFieldCls={ecusDisabledFieldCls}
											ecusClassicSelectCls={ecusClassicSelectCls}
											ecusClassicButtonCls={ecusClassicButtonCls}
											ecusDisabledButtonCls={ecusDisabledButtonCls}
										/>
									) : resolvedOperationType === "XUAT" &&
										tab.id === "export-general" ? (
										<CdsExportGeneralTab {...tabProps} />
									) : resolvedOperationType === "NHAP" &&
										tab.id === "import-general-1" ? (
										<CdsImportGeneralTab1 {...tabProps} />
									) : resolvedOperationType === "NHAP" &&
										tab.id === "import-general-2" ? (
										<CdsImportGeneralTab2 {...tabProps} />
									) : tab.kind === "form" && tab.sections.length === 0 ? (
										<div className="mx-2 mt-2 rounded-none border border-[#b9b9b9] bg-white px-3 py-2 text-[11px] text-slate-600">
											{tab.description}
										</div>
									) : (
										<div className="space-y-1 px-3 py-2 sm:px-4">
											{/* ECUS: Nhóm loại hình radio buttons at top of first tab */}
											{tab.id.includes("general") &&
												tab.id === tabConfigs[0]?.id && (
													<div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#ddd] py-1 text-[12px]">
														<span className="mr-2 font-bold text-black">
															Nhóm loại hình:
														</span>
														{ECUS_BUSINESS_GROUP_OPTIONS.map((option) => (
															<label
																key={option.value}
																className="mr-3 flex items-center gap-1 cursor-pointer"
															>
																<input
																	type="radio"
																	name="businessTypeGroup"
																	checked={
																		resolvedBusinessTypeGroup === option.value
																	}
																	onChange={() =>
																		handleFieldChange(
																			"businessTypeGroup",
																			option.value,
																		)
																	}
																	className="w-3 h-3 accent-blue-600"
																/>
																<span className="text-black">
																	{option.label}
																</span>
															</label>
														))}
													</div>
												)}

											{tab.sections.map((section) => {
												const showBillItems = BILL_ITEMS_SECTION_TITLES.has(
													section.title,
												);
												const showValuation = VALUATION_SECTION_TITLES.has(
													section.title,
												);
												const showElectronicAttachments =
													ATTACHMENT_SECTION_TITLES.has(section.title);
												const showTransportTable = TRANSPORT_SECTION_TITLES.has(
													section.title,
												);
												const showLicenseFields = LICENSE_SECTION_TITLES.has(
													section.title,
												);
												const showLegalDocumentFields =
													LEGAL_DOCUMENT_SECTION_TITLES.has(section.title);

												return (
													<div
														key={`${tab.id}-${section.title}`}
														className="mb-1"
													>
														{/* ECUS-style section header: bold italic with underline like WinForms GroupBox */}
														<div className="border-b border-[#999] pb-0.5 mb-1 mt-1">
															<span className="text-[13px] font-bold italic text-black">
																{section.title}
															</span>
														</div>

														<div>
															{/* Supervision checkboxes for Vận đơn section */}
															{showBillItems && (
																<div className="mb-1.5 ml-0 space-y-1 sm:ml-6">
																	<label className="flex items-center gap-1.5 text-[12px] text-black cursor-pointer">
																		<input
																			type="checkbox"
																			checked={!!data.seaportSupervisionEnabled}
																			onChange={(e) =>
																				handleFieldChange(
																					"seaportSupervisionEnabled",
																					e.target.checked,
																				)
																			}
																			className="w-3 h-3"
																		/>
																		Khai báo số định danh theo chuẩn quản lý
																		giám sát Hải quan tự động tại Cảng biển.
																	</label>
																	<label className="flex items-center gap-1.5 text-[12px] text-black cursor-pointer">
																		<input
																			type="checkbox"
																			checked={!!data.airportSupervisionEnabled}
																			onChange={(e) =>
																				handleFieldChange(
																					"airportSupervisionEnabled",
																					e.target.checked,
																				)
																			}
																			className="w-3 h-3"
																		/>
																		Khai báo số định danh theo chuẩn quản lý
																		giám sát Hải quan tự động tại Cảng hàng
																		không
																	</label>
																</div>
															)}

															{/* Bill Items table (ECUS: 5 rows) */}
															{showBillItems && (
																<BillItemsTable {...commonTableProps} />
															)}

															<div className="grid w-full grid-cols-1 gap-x-5 gap-y-2 lg:grid-cols-2 lg:gap-y-0">
																{section.fields.map((field) => {
																	const fieldKey =
																		field.key as keyof FollowUpCdsInfoRow;
																	const hasLookup =
																		getLookupOptionsForField(fieldKey).length >
																		0;
																	const lookupSource =
																		getLookupSourceForField(fieldKey);
																	const lookupSourceDetail =
																		getLookupSourceDetail(
																			fieldKey,
																			lookupSource,
																		);
																	const isRequired = REQUIRED_CDS_FIELDS.has(
																		field.key,
																	);
																	const subHeader = getSubSectionBeforeField(
																		field.key,
																		resolvedOperationType,
																	);

																	return (
																		<Fragment key={String(field.key)}>
																			{/* ECUS sub-section header */}
																			{subHeader && (
																				<div className="mb-0 mt-1 lg:col-span-2">
																					<span className="text-[12px] font-bold text-black">
																						{subHeader}
																					</span>
																				</div>
																			)}

																			<div
																				className={cn(
																					"flex flex-col gap-1 py-1 lg:flex-row lg:items-center lg:py-px",
																					field.type === "textarea" &&
																						"lg:col-span-2 lg:items-start",
																				)}
																			>
																				{/* Label (Mobile: left-aligned + stacked; Desktop: right-aligned, compact) */}
																				<div className="flex w-full items-start gap-1.5 lg:w-[170px] lg:min-w-[170px] lg:shrink-0 lg:items-center lg:gap-0">
																					<span
																						className="w-full leading-tight text-[12px] font-medium text-slate-800 lg:text-right lg:font-normal lg:text-black"
																						title={field.label}
																					>
																						{field.label}:
																					</span>
																					{isRequired && (
																						<span className="ml-0 text-[12px] font-bold text-red-600 shrink-0 lg:ml-0.5">
																							*
																						</span>
																					)}
																					{hasLookup &&
																						lookupSource !== "none" && (
																							<span
																								className={cn(
																									"ml-1 rounded-none px-0.5 py-px text-[8px] font-bold uppercase shrink-0 lg:ml-0.5",
																									lookupSource === "live"
																										? "bg-emerald-100 text-emerald-700"
																										: lookupSource === "app"
																											? "bg-amber-100 text-amber-700"
																											: "bg-slate-200 text-slate-600",
																								)}
																								title={lookupSourceDetail}
																							>
																								{lookupSource === "live"
																									? "●"
																									: lookupSource === "app"
																										? "◆"
																										: "○"}
																							</span>
																						)}
																				</div>

																				{/* Input */}
																				<div className="flex-1 min-w-0 w-full lg:min-w-[120px]">
																					{renderInput(field)}
																				</div>
																			</div>
																		</Fragment>
																	);
																})}
															</div>

															{/* ECUS collection tables after flat fields */}
															{showValuation && (
																<ValuationAdjustmentsTable
																	{...commonTableProps}
																/>
															)}
															{showElectronicAttachments && (
																<ElectronicAttachmentsTable
																	{...commonTableProps}
																/>
															)}
															{showTransportTable && (
																<TransportSchedulesTable
																	{...commonTableProps}
																/>
															)}
															{showLicenseFields &&
																(resolvedOperationType === "XUAT" ? (
																	<ExportLicenseDocumentTable
																		{...commonTableProps}
																	/>
																) : (
																	<ImportLicenseSlots {...commonTableProps} />
																))}
															{showLegalDocumentFields && (
																<LegalDocumentSlots {...commonTableProps} />
															)}
														</div>
													</div>
												);
											})}
										</div>
									)}
								</div>
							</TabsContent>
						))}
					</Tabs>
				</div>{" "}
				{/* END RIGHT SIDE MAIN AREA */}
				{isAiChatOpen ? (
					<aside className="relative flex h-full min-h-0 w-[clamp(360px,32vw,460px)] shrink-0 border-l border-[#8f8f8f] bg-[#efefef] shadow-[-4px_0_12px_rgba(15,23,42,0.08)]">
						<div className="min-w-0 flex-1">
							<CdsAiDocumentPanel
								followUpId={followUpId}
								operationType={resolvedOperationType}
								followUpSummary={followUpSummary}
								currentData={data}
								currentCargoList={cargoList}
								handleFieldChange={handleFieldChange}
								onCdsInfoPersisted={handleAiDocumentCdsInfoPersisted}
								onCargoApplied={handleAiDocumentCargoApplied}
								session={cdsAiSession}
								onClose={() => setIsAiChatOpen(false)}
							/>
						</div>
					</aside>
				) : null}
			</div>{" "}
			{/* END MAIN AREA LAYOUT */}
			{!isAiChatOpen ? (
				<button
					type="button"
					onClick={handleCdsAiFloatingAction}
					title={cdsAiFloatingTitle}
					aria-label={cdsAiFloatingTitle}
					className={`absolute right-4 bottom-4 z-40 inline-flex min-h-[36px] items-center gap-2 border border-[#14314b] bg-[linear-gradient(180deg,#1f4f73_0%,#14314b_100%)] px-4 py-1.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.2)] hover:bg-[linear-gradient(180deg,#245f8b_0%,#173d5c_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315d8f] focus-visible:ring-offset-2 ${cdsAiSession.isAnalyzing ? "cds-ai-pulse-glow" : ""}`}
				>
					{cdsAiSession.isAnalyzing ? (
						<Loader2 className="size-3.5 animate-spin" />
					) : (
						<Bot className="size-3.5" />
					)}
					<span>{cdsAiFloatingLabel}</span>
					{cdsAiSession.attachedSourceCount > 0 ? (
						<span className="border border-white/30 bg-white/15 px-1.5 py-px text-[9px] font-semibold leading-none text-white">
							{cdsAiSession.attachedSourceCount} nguồn
						</span>
					) : null}
					{aiFieldReviewTotal > 0 ? (
						<span className="-top-1 -right-1 absolute inline-flex h-[16px] min-w-[16px] items-center justify-center border border-amber-500 bg-amber-300 px-0.5 text-[8px] font-bold leading-none text-[#4a3100]">
							{aiFieldReviewTotal}
						</span>
					) : null}
				</button>
			) : null}
		</div>
	);

	return (
		<BufferedCdsFieldRegistryProvider
			registry={bufferedFieldRegistryRef.current}
		>
			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				{!isModalOpen ? (
					<div
						data-no-drag-scroll
						className="flex min-h-[250px] flex-col items-center justify-center bg-slate-50/50 px-6 py-12"
					>
						<Button
							render={<DialogTrigger />}
							className="h-auto gap-2 rounded-[4px] bg-[#315d8f] px-6 py-5 text-[14px] text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[#25466b]"
						>
							<ClipboardList className="size-5" />
							Mở bảng khai báo hải quan (CDS)
						</Button>
						<p className="mt-4 max-w-[400px] text-center text-[12px] leading-relaxed text-slate-500">
							Giao diện CDS rất lớn nên được mở dạng module toàn màn hình
							(fullscreen) để thao tác dễ dàng giống phần mềm ECUS. Dữ liệu{" "}
							{isLoading ? "đang được tải ngầm..." : "đã sẵn sàng."}
						</p>
					</div>
				) : null}
				{isModalOpen ? (
					<DialogContent
						className="!inset-[6px] !grid-rows-[1fr] !m-0 !h-auto !w-auto !max-h-none !max-w-none !translate-x-0 !translate-y-0 !gap-0 !p-0 overflow-hidden bg-white shadow-2xl !rounded-none sm:!inset-3 sm:!rounded-xl xl:!inset-6"
						showCloseButton={false}
					>
						<DialogTitle className="sr-only">Khai báo CDS</DialogTitle>
						<div className="flex h-full min-h-0 min-w-0 w-full flex-col">
							{modalContent}
						</div>
					</DialogContent>
				) : null}
			</Dialog>
		</BufferedCdsFieldRegistryProvider>
	);
}
