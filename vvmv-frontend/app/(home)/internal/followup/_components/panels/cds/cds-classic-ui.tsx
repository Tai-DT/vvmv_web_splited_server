// cds-classic-ui.tsx – classic UI components extracted from cds-info-panel.tsx (Phase 4)
"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FollowUpCdsInfoRow } from "../../../types";
import { DatePickerInput } from "./cds-date-picker";
import type { FieldRenderLockOptions, SelectOption } from "./cds-lookup-types";
import { stopCdsInteraction } from "./cds-utils";

const BUFFERED_FIELD_COMMIT_DELAY_MS = 400;

function afterNextPaint(callback: () => void) {
	if (
		typeof window === "undefined" ||
		typeof window.requestAnimationFrame !== "function"
	) {
		globalThis.setTimeout(callback, 0);
		return;
	}

	window.requestAnimationFrame(() => {
		window.requestAnimationFrame(callback);
	});
}

export type BufferedCdsFieldRegistry = {
	flush: () => void;
	flushAndWait: () => Promise<void>;
	registerFlusher: (flushValue: () => void) => () => void;
};

function waitForBufferedFieldCommits() {
	return new Promise<void>((resolve) => {
		afterNextPaint(resolve);
	});
}

function createBufferedCdsFieldRegistryInstance(): BufferedCdsFieldRegistry {
	const flushers = new Set<() => void>();

	const flush = () => {
		Array.from(flushers).forEach((flushValue) => {
			flushValue();
		});
	};

	return {
		flush,
		flushAndWait: async () => {
			flush();
			await waitForBufferedFieldCommits();
		},
		registerFlusher: (flushValue) => {
			flushers.add(flushValue);

			return () => {
				flushers.delete(flushValue);
			};
		},
	};
}

const DEFAULT_BUFFERED_CDS_FIELD_REGISTRY =
	createBufferedCdsFieldRegistryInstance();

const BufferedCdsFieldRegistryContext =
	createContext<BufferedCdsFieldRegistry | null>(null);

export function createBufferedCdsFieldRegistry() {
	return createBufferedCdsFieldRegistryInstance();
}

export function BufferedCdsFieldRegistryProvider({
	children,
	registry,
}: {
	children: React.ReactNode;
	registry: BufferedCdsFieldRegistry;
}) {
	return (
		<BufferedCdsFieldRegistryContext.Provider value={registry}>
			{children}
		</BufferedCdsFieldRegistryContext.Provider>
	);
}

export function flushBufferedCdsFieldCommits() {
	DEFAULT_BUFFERED_CDS_FIELD_REGISTRY.flush();
}

export function waitForBufferedCdsFieldCommits() {
	return waitForBufferedFieldCommits();
}

export async function flushBufferedCdsFieldCommitsAndWait() {
	await DEFAULT_BUFFERED_CDS_FIELD_REGISTRY.flushAndWait();
}

export interface CdsClassicUiProps {
	data: Partial<FollowUpCdsInfoRow>;
	handleFieldChange: (key: string, value: unknown) => void;
	suppressManualScrollRestore?: (applyChange: () => void) => void;
	getLookupOptionsForField: (key: keyof FollowUpCdsInfoRow) => SelectOption[];
	getInitialEntryLockReason: (key: keyof FollowUpCdsInfoRow) => string | null;
	usesManualLookupPicker: (key: keyof FollowUpCdsInfoRow) => boolean;
	openLookupDialogForField: (key: keyof FollowUpCdsInfoRow) => void;
	resolveFieldLockState: (
		fieldKey: keyof FollowUpCdsInfoRow,
		options?: FieldRenderLockOptions,
	) => { disabledReason: string | null; isDisabled: boolean };
	getLookupDescription: (key: keyof FollowUpCdsInfoRow) => string;
	ecusInputCls: string;
	ecusSelectCls: string;
	ecusTextareaCls: string;
	ecusDisabledFieldCls: string;
	ecusDisabledButtonCls: string;
	ecusClassicInputCls: string;
	ecusClassicSelectCls: string;
	ecusClassicReadonlyCls: string;
	ecusClassicButtonCls: string;
}

export const ClassicLabel: React.FC<{ label: string; required?: boolean }> = ({
	label,
	required,
}) => (
	<span className="text-[11px] text-[#1e395b]">
		{label}:{required && <span className="ml-1 text-red-600 font-bold">*</span>}
	</span>
);

export const ClassicSectionHeader: React.FC<{ title: string }> = ({
	title,
}) => (
	<div className="bg-[#315d8f] px-2 py-0.5 text-[12px] font-bold text-white">
		{title}
	</div>
);

export interface ClassicDateInputProps {
	fieldKey: keyof FollowUpCdsInfoRow;
	data: Partial<FollowUpCdsInfoRow>;
	handleFieldChange: (key: string, value: unknown) => void;
	getInitialEntryLockReason: (key: keyof FollowUpCdsInfoRow) => string | null;
	ecusClassicInputCls: string;
	ecusDisabledFieldCls: string;
	className?: string;
}

export const ClassicDateInput: React.FC<ClassicDateInputProps> = ({
	fieldKey,
	data,
	handleFieldChange,
	getInitialEntryLockReason,
	ecusClassicInputCls,
	ecusDisabledFieldCls,
	className,
}) => {
	const value = data[fieldKey];
	const lockReason = getInitialEntryLockReason(fieldKey);
	const isDisabled = lockReason !== null;

	return (
		<DatePickerInput
			value={typeof value === "string" ? value.substring(0, 10) : ""}
			onChange={(iso) => handleFieldChange(fieldKey as string, iso)}
			disabled={isDisabled}
			title={lockReason ?? undefined}
			inputClassName={cn(
				ecusClassicInputCls,
				isDisabled && ecusDisabledFieldCls,
				className,
			)}
			triggerClassName={cn(
				"h-[22px] w-[22px] border-l-0 rounded-none border border-slate-500 bg-[#d9d9d9] text-slate-700 hover:bg-[#ebebeb]",
				isDisabled && "border-[#b5b5b5] bg-[#d8d8d8] text-slate-700",
			)}
			wrapperClassName="flex-1 min-w-0"
		/>
	);
};

export interface ClassicInputProps extends CdsClassicUiProps {
	fieldKey: keyof FollowUpCdsInfoRow;
	className?: string;
	placeholder?: string;
	lockOptions?: FieldRenderLockOptions;
	displayMode?: "code-and-description" | "code-only";
	maxLength?: number;
}

function getFieldStringValue(value: unknown) {
	return value === null || value === undefined ? "" : String(value);
}

function isNativeComposing(
	nativeEvent: Event | undefined,
): nativeEvent is Event & { isComposing: true } {
	return (
		(nativeEvent as { isComposing?: boolean } | undefined)?.isComposing === true
	);
}

type ClassicOptionSelectProps = {
	fieldKey: keyof FollowUpCdsInfoRow;
	value: string;
	options: SelectOption[];
	onValueChange: (value: string | null) => void;
	disabled: boolean;
	disabledReason: string | null;
	className?: string;
	triggerClassName: string;
	disabledFieldClassName: string;
	placeholder?: string;
	onOpenLookupDialog?: (fieldKey: keyof FollowUpCdsInfoRow) => void;
	showSearchButton?: boolean;
};

function findClassicSelectedOption(
	options: SelectOption[],
	normalizedValue: string,
) {
	if (!normalizedValue) {
		return null;
	}

	return (
		options.find((option) => option.value === normalizedValue) ??
		options.find((option) => option.label === normalizedValue) ??
		options.find((option) =>
			normalizedValue.startsWith(`${option.value} - `),
		) ??
		null
	);
}

const REVERSE_LOOKUP_BY_LABEL_FIELDS = new Set<keyof FollowUpCdsInfoRow>([
	"loadingLocationCode",
	"unloadingLocationCode",
]);

function normalizeClassicLookupSearchText(value: string) {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.toUpperCase();
}

function findClassicOptionBySearchText(
	options: SelectOption[],
	input: string,
): SelectOption | null {
	const normalizedInput = normalizeClassicLookupSearchText(input);
	if (!normalizedInput) {
		return null;
	}

	const scoredMatches = options
		.map((option) => {
			const normalizedValue = normalizeClassicLookupSearchText(option.value);
			const normalizedLabel = normalizeClassicLookupSearchText(option.label);
			const description = getClassicOptionDescription(option);
			const normalizedDescription =
				normalizeClassicLookupSearchText(description);

			let score = 0;
			if (normalizedValue === normalizedInput) {
				score = 100;
			} else if (normalizedLabel === normalizedInput) {
				score = 95;
			} else if (normalizedDescription === normalizedInput) {
				score = 90;
			} else if (normalizedLabel.includes(normalizedInput)) {
				score = 70;
			} else if (normalizedDescription.includes(normalizedInput)) {
				score = 65;
			}

			return { option, score };
		})
		.filter((item) => item.score > 0)
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.option.value.localeCompare(right.option.value),
		);

	return scoredMatches[0]?.option ?? null;
}

function getClassicResolvedValue(
	normalizedValue: string,
	matchedSelectedOption: SelectOption | null,
) {
	if (matchedSelectedOption?.value) {
		return matchedSelectedOption.value;
	}

	const labelSeparatorIndex = normalizedValue.indexOf(" - ");
	if (labelSeparatorIndex > 0) {
		return normalizedValue.slice(0, labelSeparatorIndex).trim();
	}

	return normalizedValue;
}

function getClassicOptionDescription(option: SelectOption) {
	const normalizedLabel = option.label.trim();
	const normalizedValue = option.value.trim();
	const labelPrefix = `${normalizedValue} - `;

	if (normalizedLabel.startsWith(labelPrefix)) {
		return normalizedLabel.slice(labelPrefix.length).trim();
	}

	return normalizedLabel;
}

function getClassicOptionDisplayLabel(
	option: SelectOption,
	displayMode: "code-and-description" | "code-only" = "code-and-description",
) {
	const normalizedLabel = option.label.trim();
	const normalizedValue = option.value.trim();

	if (displayMode === "code-only") {
		return normalizedValue || normalizedLabel;
	}

	if (
		!normalizedValue ||
		!normalizedLabel ||
		normalizedLabel === normalizedValue
	) {
		return normalizedLabel || normalizedValue;
	}

	const labelPrefix = `${normalizedValue} - `;
	return normalizedLabel.startsWith(labelPrefix)
		? normalizedLabel
		: `${normalizedValue} - ${normalizedLabel}`;
}

function stripClassicCodePrefix(value: unknown, code?: string | null) {
	const text = getFieldStringValue(value).trim();
	if (!text) {
		return "";
	}

	const normalizedCode = String(code ?? "").trim();
	if (normalizedCode) {
		const codePrefix = `${normalizedCode} - `;
		if (text.startsWith(codePrefix)) {
			return text.slice(codePrefix.length).trim();
		}
	}

	const separatorIndex = text.indexOf(" - ");
	if (separatorIndex > 0 && separatorIndex <= 16) {
		return text.slice(separatorIndex + 3).trim();
	}

	return text;
}

const NATIVE_SELECT_INTERACTION_WINDOW_MS = 800;
const NATIVE_SELECT_SCROLL_LOCK_TIMEOUT_MS = 1000;
const CDS_EDITABLE_CONTROL_SELECTOR = [
	'input:not([type="button"]):not([type="checkbox"]):not([type="file"]):not([type="hidden"]):not([type="radio"]):not([type="reset"]):not([type="submit"])',
	"select",
	"textarea",
].join(",");
let pendingNativeSelectInteractionUntil = 0;
let pendingCdsFocusAnchor: HTMLElement | null = null;

type FocusNextCdsOptions = {
	direction?: "next" | "down";
	retry?: boolean;
};

type NativeSelectScrollLock = {
	left: number;
	rafId: number | null;
	region: HTMLElement;
	restoreOnScroll: () => void;
	timeoutId: number | null;
	top: number;
};

let nativeSelectScrollLock: NativeSelectScrollLock | null = null;

type CdsScrollSnapshot = {
	left: number;
	region: HTMLElement;
	top: number;
};

function isCdsEditableControl(element: Element): element is HTMLElement {
	if (!(element instanceof HTMLElement)) {
		return false;
	}

	if (
		element.matches(
			"[disabled], [readonly], [aria-disabled='true'], [data-cds-skip-auto-focus='true']",
		)
	) {
		return false;
	}

	if (element.tabIndex < 0) {
		return false;
	}

	return true;
}

function getCdsFocusScope(anchor: HTMLElement) {
	return (
		anchor.closest<HTMLElement>('[data-cds-scroll-region="active"]') ??
		anchor.closest<HTMLElement>(".cds-visible-y-scrollbar") ??
		anchor.closest<HTMLElement>("[role='dialog']") ??
		document
	);
}

function getCdsEditableControls(anchor: HTMLElement) {
	const scope = getCdsFocusScope(anchor);
	return Array.from(
		scope.querySelectorAll<HTMLElement>(CDS_EDITABLE_CONTROL_SELECTOR),
	).filter(isCdsEditableControl);
}

function getNextCdsEditableControlInDomOrder(
	anchor: HTMLElement,
	controls = getCdsEditableControls(anchor),
) {
	const currentIndex = controls.indexOf(anchor);

	if (currentIndex >= 0) {
		return controls[currentIndex + 1] ?? null;
	}

	return (
		controls.find((control) =>
			Boolean(
				anchor.compareDocumentPosition(control) &
					Node.DOCUMENT_POSITION_FOLLOWING,
			),
		) ?? null
	);
}

function getNextCdsEditableControlBelow(
	anchor: HTMLElement,
	controls = getCdsEditableControls(anchor),
) {
	const anchorRect = anchor.getBoundingClientRect();
	const anchorCenterX = anchorRect.left + anchorRect.width / 2;
	const anchorReferenceWidth = Math.max(anchorRect.width, 1);

	const candidates = controls
		.filter((control) => control !== anchor)
		.map((control) => {
			const rect = control.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const horizontalOverlap =
				Math.min(anchorRect.right, rect.right) -
				Math.max(anchorRect.left, rect.left);
			const centerDistance = Math.abs(centerX - anchorCenterX);
			const columnTolerance = Math.max(
				Math.min(anchorReferenceWidth, rect.width) * 0.75,
				18,
			);

			return {
				centerDistance,
				control,
				isSameColumn:
					horizontalOverlap > 0 || centerDistance <= columnTolerance,
				verticalDistance: rect.top - anchorRect.top,
			};
		})
		.filter(
			(candidate) => candidate.verticalDistance > 4 && candidate.isSameColumn,
		)
		.sort((left, right) => {
			if (left.verticalDistance !== right.verticalDistance) {
				return left.verticalDistance - right.verticalDistance;
			}

			return left.centerDistance - right.centerDistance;
		});

	return candidates[0]?.control ?? null;
}

function getNextCdsEditableControl(
	anchor: HTMLElement,
	direction: FocusNextCdsOptions["direction"] = "next",
) {
	const controls = getCdsEditableControls(anchor);

	if (direction === "down") {
		return (
			getNextCdsEditableControlBelow(anchor, controls) ??
			getNextCdsEditableControlInDomOrder(anchor, controls)
		);
	}

	return getNextCdsEditableControlInDomOrder(anchor, controls);
}

function getCdsScrollRegion(anchor: HTMLElement) {
	return (
		anchor.closest<HTMLElement>('[data-cds-scroll-region="active"]') ??
		anchor.closest<HTMLElement>(".cds-visible-y-scrollbar") ??
		null
	);
}

function captureCdsScrollSnapshot(
	anchor: HTMLElement,
): CdsScrollSnapshot | null {
	const region = getCdsScrollRegion(anchor);

	if (!region) {
		return null;
	}

	return {
		left: region.scrollLeft,
		region,
		top: region.scrollTop,
	};
}

function restoreCdsScrollSnapshot(snapshot: CdsScrollSnapshot | null) {
	if (!snapshot) {
		return;
	}

	snapshot.region.scrollTop = snapshot.top;
	snapshot.region.scrollLeft = snapshot.left;
}

function restoreCdsScrollSnapshotAfterFocus(
	snapshot: CdsScrollSnapshot | null,
) {
	restoreCdsScrollSnapshot(snapshot);

	if (!snapshot || typeof window === "undefined") {
		return;
	}

	if (typeof window.requestAnimationFrame === "function") {
		window.requestAnimationFrame(() => {
			restoreCdsScrollSnapshot(snapshot);
			window.requestAnimationFrame(() => restoreCdsScrollSnapshot(snapshot));
		});
	}

	window.setTimeout(() => restoreCdsScrollSnapshot(snapshot), 0);
	window.setTimeout(() => restoreCdsScrollSnapshot(snapshot), 50);
	window.setTimeout(() => restoreCdsScrollSnapshot(snapshot), 150);
}

function focusCdsEditableControl(control: HTMLElement) {
	const alreadyFocused = document.activeElement === control;

	if (!alreadyFocused) {
		try {
			control.focus({ preventScroll: true });
		} catch {
			control.focus();
		}
	}

	if (
		!alreadyFocused &&
		(control instanceof HTMLInputElement ||
			control instanceof HTMLTextAreaElement)
	) {
		const valueLength = control.value.length;
		control.setSelectionRange(valueLength, valueLength);
	}
}

function shouldFocusNextFromAnchor(
	anchor: HTMLElement,
	nextControl: HTMLElement,
) {
	const activeElement = document.activeElement;

	if (
		!activeElement ||
		activeElement === document.body ||
		activeElement === anchor ||
		activeElement === nextControl
	) {
		return true;
	}

	return (
		activeElement instanceof HTMLElement &&
		activeElement.closest("[role='dialog']") !== null
	);
}

export function focusNextCdsEditableControl(
	anchor: HTMLElement | null,
	options: FocusNextCdsOptions = {},
) {
	if (!anchor || typeof document === "undefined") {
		return;
	}

	const focusNext = () => {
		const nextControl = getNextCdsEditableControl(anchor, options.direction);

		if (!nextControl) {
			return;
		}

		if (!shouldFocusNextFromAnchor(anchor, nextControl)) {
			return;
		}

		const scrollSnapshot = captureCdsScrollSnapshot(anchor);
		focusCdsEditableControl(nextControl);
		restoreCdsScrollSnapshotAfterFocus(scrollSnapshot);
	};

	focusNext();

	if (!options.retry || typeof window === "undefined") {
		return;
	}

	if (typeof window.requestAnimationFrame === "function") {
		window.requestAnimationFrame(focusNext);
	}

	window.setTimeout(focusNext, 0);
}

export function markCdsFocusAnchor(anchor: HTMLElement | null) {
	pendingCdsFocusAnchor = anchor;
}

export function focusNextFromCdsFocusAnchor() {
	const anchor = pendingCdsFocusAnchor;
	pendingCdsFocusAnchor = null;
	focusNextCdsEditableControl(anchor, { retry: true });
}

function getNativeSelectInteractionTimestamp() {
	if (
		typeof performance !== "undefined" &&
		typeof performance.now === "function"
	) {
		return performance.now();
	}

	return Date.now();
}

function consumePendingNativeSelectInteraction() {
	const now = getNativeSelectInteractionTimestamp();
	if (now > pendingNativeSelectInteractionUntil) {
		return false;
	}

	pendingNativeSelectInteractionUntil = 0;
	return true;
}

function shouldTreatBlurTargetAsNativeSelect(
	relatedTarget: EventTarget | null,
) {
	if (relatedTarget instanceof HTMLSelectElement) {
		pendingNativeSelectInteractionUntil = 0;
		return true;
	}

	return consumePendingNativeSelectInteraction();
}

function restoreNativeSelectScrollLock(lock: NativeSelectScrollLock | null) {
	if (!lock) {
		return;
	}

	lock.region.scrollTop = lock.top;
	lock.region.scrollLeft = lock.left;
}

function releaseNativeSelectScrollLock(lock: NativeSelectScrollLock | null) {
	if (!lock) {
		return;
	}

	if (lock.timeoutId !== null) {
		window.clearTimeout(lock.timeoutId);
	}

	if (lock.rafId !== null) {
		window.cancelAnimationFrame(lock.rafId);
	}

	lock.region.removeEventListener("scroll", lock.restoreOnScroll);

	if (nativeSelectScrollLock === lock) {
		nativeSelectScrollLock = null;
	}
}

function captureNativeSelectScrollLock(selectElement: HTMLSelectElement) {
	const scrollRegion = getCdsScrollRegion(selectElement);

	if (!scrollRegion) {
		releaseNativeSelectScrollLock(nativeSelectScrollLock);
		return;
	}

	if (nativeSelectScrollLock?.region !== scrollRegion) {
		releaseNativeSelectScrollLock(nativeSelectScrollLock);
	}

	if (!nativeSelectScrollLock) {
		const lock: NativeSelectScrollLock = {
			left: scrollRegion.scrollLeft,
			rafId: null,
			region: scrollRegion,
			restoreOnScroll: () => restoreNativeSelectScrollLock(lock),
			timeoutId: null,
			top: scrollRegion.scrollTop,
		};

		scrollRegion.addEventListener("scroll", lock.restoreOnScroll);
		nativeSelectScrollLock = lock;
	} else {
		nativeSelectScrollLock.top = scrollRegion.scrollTop;
		nativeSelectScrollLock.left = scrollRegion.scrollLeft;
	}

	if (nativeSelectScrollLock.timeoutId !== null) {
		window.clearTimeout(nativeSelectScrollLock.timeoutId);
	}

	nativeSelectScrollLock.timeoutId = window.setTimeout(() => {
		releaseNativeSelectScrollLock(nativeSelectScrollLock);
	}, NATIVE_SELECT_SCROLL_LOCK_TIMEOUT_MS);
}

export function markPendingNativeSelectInteraction(
	eventOrTarget?:
		| HTMLSelectElement
		| { currentTarget: EventTarget | null }
		| null,
) {
	pendingNativeSelectInteractionUntil =
		getNativeSelectInteractionTimestamp() + NATIVE_SELECT_INTERACTION_WINDOW_MS;

	const selectElement =
		eventOrTarget instanceof HTMLSelectElement
			? eventOrTarget
			: eventOrTarget?.currentTarget instanceof HTMLSelectElement
				? eventOrTarget.currentTarget
				: null;

	if (!selectElement) {
		return;
	}

	try {
		selectElement.focus({ preventScroll: true });
	} catch {
		selectElement.focus();
	}

	captureNativeSelectScrollLock(selectElement);
}

export function finalizeNativeSelectInteraction() {
	const lock = nativeSelectScrollLock;

	if (!lock) {
		return;
	}

	restoreNativeSelectScrollLock(lock);

	if (lock.rafId !== null) {
		window.cancelAnimationFrame(lock.rafId);
	}

	// Hold the scroll lock through several frames so that any post-commit
	// re-render or focus-induced auto-scroll cannot snap the panel up.
	let frameCount = 0;
	const maxFrames = 6;
	const tick = () => {
		restoreNativeSelectScrollLock(lock);
		frameCount += 1;
		if (frameCount >= maxFrames) {
			lock.rafId = null;
			return;
		}
		lock.rafId = window.requestAnimationFrame(tick);
	};
	lock.rafId = window.requestAnimationFrame(tick);

	if (lock.timeoutId !== null) {
		window.clearTimeout(lock.timeoutId);
	}

	// Keep the scroll listener active for a short tail so any straggling
	// browser-initiated scroll (e.g. from select blur) is also rolled back.
	lock.timeoutId = window.setTimeout(() => {
		restoreNativeSelectScrollLock(lock);
		releaseNativeSelectScrollLock(lock);
	}, 250);
}

const CLASSIC_CODE_WIDTH_CLASSES = [
	"w-[40px]",
	"w-[48px]",
	"w-[56px]",
	"w-[64px]",
	"w-[72px]",
	"w-[80px]",
	"w-[88px]",
	"w-[96px]",
	"w-[100px]",
] as const;

type ClassicCodeWidthClass = (typeof CLASSIC_CODE_WIDTH_CLASSES)[number];

const CLASSIC_SELECT_MIN_CODE_WIDTHS: Partial<
	Record<keyof FollowUpCdsInfoRow, ClassicCodeWidthClass>
> = {
	cargoClassificationCode: "w-[40px]",
	declarationProcessingDeptCode: "w-[48px]",
	insuranceFeeClassificationCode: "w-[48px]",
	insuranceFeeCurrencyCode: "w-[56px]",
	invoiceClassificationCode: "w-[48px]",
	invoiceCurrency: "w-[56px]",
	invoiceFormClassificationCode: "w-[48px]",
	invoicePriceCondition: "w-[56px]",
	packageType: "w-[56px]",
	paymentMethod: "w-[56px]",
	personOrganizationClassification: "w-[40px]",
	taxPayer: "w-[40px]",
	taxableValueCurrencyCode: "w-[56px]",
	transportFeeClassificationCode: "w-[48px]",
	transportFeeCurrencyCode: "w-[56px]",
	transportMethodCode: "w-[40px]",
	valuationDeclarationTypeCode: "w-[48px]",
	weightUnit: "w-[56px]",
};

const CLASSIC_CODE_ONLY_MIN_CODE_WIDTHS: Partial<
	Record<keyof FollowUpCdsInfoRow, ClassicCodeWidthClass>
> = {
	cargoClassificationCode: "w-[48px]",
	declarationProcessingDeptCode: "w-[56px]",
	insuranceFeeClassificationCode: "w-[48px]",
	insuranceFeeCurrencyCode: "w-[64px]",
	invoiceClassificationCode: "w-[48px]",
	invoiceCurrency: "w-[64px]",
	invoiceFormClassificationCode: "w-[48px]",
	invoicePriceCondition: "w-[56px]",
	packageType: "w-[64px]",
	paymentMethod: "w-[56px]",
	personOrganizationClassification: "w-[48px]",
	taxPayer: "w-[56px]",
	taxableValueCurrencyCode: "w-[64px]",
	transportFeeClassificationCode: "w-[48px]",
	transportFeeCurrencyCode: "w-[64px]",
	transportMethodCode: "w-[48px]",
	valuationDeclarationTypeCode: "w-[48px]",
	weightUnit: "w-[64px]",
};

function getClassicCodeWidthClass(
	fieldKey: keyof FollowUpCdsInfoRow,
	resolvedValue: string,
	options: SelectOption[],
	displayMode: "code-and-description" | "code-only" = "code-and-description",
) {
	const maxLength = Math.max(
		resolvedValue.trim().length,
		...options.map((option) => option.value.trim().length),
	);

	const dynamicClass: ClassicCodeWidthClass =
		maxLength <= 2
			? "w-[40px]"
			: maxLength <= 3
				? "w-[48px]"
				: maxLength <= 4
					? "w-[56px]"
					: maxLength <= 5
						? "w-[64px]"
						: maxLength <= 6
							? "w-[72px]"
							: maxLength <= 7
								? "w-[80px]"
								: maxLength <= 8
									? "w-[88px]"
									: "w-[96px]";

	const preferredMinWidthClass =
		displayMode === "code-only"
			? (CLASSIC_CODE_ONLY_MIN_CODE_WIDTHS[fieldKey] ??
				CLASSIC_SELECT_MIN_CODE_WIDTHS[fieldKey])
			: CLASSIC_SELECT_MIN_CODE_WIDTHS[fieldKey];
	const standardizedWidthClass =
		displayMode === "code-only" ? "w-[64px]" : "w-[100px]";
	if (!preferredMinWidthClass) {
		const dynamicIndex = CLASSIC_CODE_WIDTH_CLASSES.indexOf(dynamicClass);
		const standardizedIndex = CLASSIC_CODE_WIDTH_CLASSES.indexOf(
			standardizedWidthClass,
		);

		return CLASSIC_CODE_WIDTH_CLASSES[
			Math.max(dynamicIndex, standardizedIndex)
		];
	}

	const dynamicIndex = CLASSIC_CODE_WIDTH_CLASSES.indexOf(dynamicClass);
	const preferredIndex = CLASSIC_CODE_WIDTH_CLASSES.indexOf(
		preferredMinWidthClass,
	);
	const standardizedIndex = CLASSIC_CODE_WIDTH_CLASSES.indexOf(
		standardizedWidthClass,
	);

	return CLASSIC_CODE_WIDTH_CLASSES[
		Math.max(dynamicIndex, preferredIndex, standardizedIndex)
	];
}

function preventLookupButtonFocusShift(
	event: React.MouseEvent<HTMLButtonElement>,
) {
	event.preventDefault();
}

const CLASSIC_COMPOUND_CONTROL_GAP_CLS = "gap-px";
const CLASSIC_CODE_INPUT_ACCENT_CLS =
	"bg-[#fffdfa] text-center font-medium tracking-[0.01em] text-[#213955] placeholder:text-center";
const CLASSIC_CODE_ONLY_INPUT_ACCENT_CLS =
	"bg-[#fffdfa] px-1 text-center font-medium tracking-[0.01em] text-[#213955] placeholder:text-center";
const CLASSIC_PICKER_BUTTON_CLS =
	"w-[22px] shrink-0 px-0 text-[11px] font-semibold leading-none";
const CLASSIC_SELECT_CONTROL_CLS =
	"w-full appearance-none rounded-none border border-[#7f7f7f] bg-white pl-1 pr-[20px] text-[11px] leading-[20px] text-slate-900 shadow-none outline-none focus:border-[#315d8f] focus-visible:ring-0 disabled:border-[#8c8c8c] disabled:bg-[#d9d9d9] disabled:text-black disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";
const CLASSIC_SELECT_TRIGGER_ONLY_CLS =
	"text-transparent [-webkit-text-fill-color:transparent] disabled:text-transparent disabled:[-webkit-text-fill-color:transparent]";
const CLASSIC_SELECT_CARET_BUTTON_CLS =
	"pointer-events-none absolute bottom-px right-px top-px flex w-[18px] items-center justify-center border-l border-[#8a8a8a] bg-[linear-gradient(180deg,#f7f7f7_0%,#d7d7d7_100%)] shadow-[inset_1px_1px_0_#ffffff,inset_-1px_-1px_0_#b5b5b5]";
const CLASSIC_SELECT_CARET_DISABLED_CLS =
	"border-l-[#9a9a9a] bg-[linear-gradient(180deg,#e6e6e6_0%,#d0d0d0_100%)] shadow-none";
const CLASSIC_SEARCHABLE_OPTION_THRESHOLD = 80;

const ClassicSelectCaret: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
	<span
		aria-hidden="true"
		data-classic-select-adornment="caret"
		className={cn(
			CLASSIC_SELECT_CARET_BUTTON_CLS,
			disabled && CLASSIC_SELECT_CARET_DISABLED_CLS,
		)}
	>
		<span className="h-0 w-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#3b3b3b]" />
	</span>
);

function useBufferedFieldValue({
	value,
	onCommit,
	disabled,
	readOnly,
}: {
	value: string;
	onCommit: (value: string) => void;
	disabled?: boolean;
	readOnly?: boolean;
}) {
	const [draftValue, setDraftValueState] = useState(value);
	const [isComposing, setIsComposing] = useState(false);
	const fieldRegistry =
		useContext(BufferedCdsFieldRegistryContext) ??
		DEFAULT_BUFFERED_CDS_FIELD_REGISTRY;
	const latestDraftValueRef = useRef(value);
	const latestCommittedValueRef = useRef(value);
	const latestOnCommitRef = useRef(onCommit);
	const isFocusedRef = useRef(false);
	const isComposingRef = useRef(false);

	useEffect(() => {
		latestOnCommitRef.current = onCommit;
	}, [onCommit]);

	useEffect(() => {
		if (value === latestCommittedValueRef.current) {
			return;
		}

		latestCommittedValueRef.current = value;

		if (
			(isFocusedRef.current || isComposingRef.current) &&
			value !== latestDraftValueRef.current
		) {
			return;
		}

		latestDraftValueRef.current = value;
		setDraftValueState(value);
	}, [value]);

	const setDraftValue = useCallback((nextValue: string) => {
		latestDraftValueRef.current = nextValue;
		setDraftValueState(nextValue);
	}, []);

	const commitValue = useCallback(
		(nextValue: string, mode: "deferred" | "immediate" = "deferred") => {
			if (nextValue === latestCommittedValueRef.current) {
				return;
			}

			latestCommittedValueRef.current = nextValue;
			const applyCommit = () => latestOnCommitRef.current(nextValue);

			if (mode === "immediate") {
				applyCommit();
				return;
			}

			applyCommit();
		},
		[],
	);

	useEffect(() => {
		if (disabled || readOnly || isComposing || isFocusedRef.current) {
			return;
		}

		if (draftValue === latestCommittedValueRef.current) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			commitValue(draftValue);
		}, BUFFERED_FIELD_COMMIT_DELAY_MS);

		return () => window.clearTimeout(timeoutId);
	}, [commitValue, disabled, draftValue, isComposing, readOnly]);

	const flushValue = useCallback(() => {
		commitValue(latestDraftValueRef.current, "immediate");
	}, [commitValue]);

	useEffect(() => {
		return fieldRegistry.registerFlusher(flushValue);
	}, [fieldRegistry, flushValue]);

	return {
		draftValue,
		setDraftValue,
		flushValue,
		setIsComposing,
		setIsFocused: (nextValue: boolean) => {
			isFocusedRef.current = nextValue;
		},
		isComposingRef,
	};
}

type BufferedInputProps = Omit<
	React.ComponentProps<typeof Input>,
	"value" | "defaultValue" | "onChange"
> & {
	value: string;
	onCommit: (value: string) => void;
	suppressManualScrollRestore?: (applyChange: () => void) => void;
};

export const BufferedInput: React.FC<BufferedInputProps> = ({
	value,
	onCommit,
	suppressManualScrollRestore,
	onBlur,
	onCompositionEnd,
	onCompositionStart,
	onFocus,
	onKeyDown,
	disabled,
	readOnly,
	...props
}) => {
	const {
		draftValue,
		setDraftValue,
		flushValue,
		setIsComposing,
		setIsFocused,
		isComposingRef,
	} = useBufferedFieldValue({
		value,
		onCommit,
		disabled,
		readOnly,
	});

	return (
		<Input
			{...props}
			value={draftValue}
			disabled={disabled}
			readOnly={readOnly}
			onChange={(event) => setDraftValue(event.target.value)}
			onCompositionStart={(event) => {
				isComposingRef.current = true;
				setIsComposing(true);
				onCompositionStart?.(event);
			}}
			onCompositionEnd={(event) => {
				isComposingRef.current = false;
				setIsComposing(false);
				setDraftValue(event.currentTarget.value);

				if (
					!document.hasFocus() ||
					document.activeElement !== event.currentTarget
				) {
					flushValue();
				}

				onCompositionEnd?.(event);
			}}
			onFocus={(event) => {
				setIsFocused(true);
				onFocus?.(event);
			}}
			onBlur={(event) => {
				setIsFocused(false);

				if (!isComposingRef.current && !isNativeComposing(event.nativeEvent)) {
					if (
						suppressManualScrollRestore &&
						shouldTreatBlurTargetAsNativeSelect(event.relatedTarget)
					) {
						suppressManualScrollRestore(flushValue);
					} else {
						flushValue();
					}
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
					flushValue();
					focusNextCdsEditableControl(event.currentTarget, {
						direction: "down",
					});
				}

				onKeyDown?.(event);
			}}
		/>
	);
};

type BufferedTextareaProps = Omit<
	TextareaProps,
	"value" | "defaultValue" | "onChange"
> & {
	value: string;
	onCommit: (value: string) => void;
	suppressManualScrollRestore?: (applyChange: () => void) => void;
};

export const BufferedTextarea: React.FC<BufferedTextareaProps> = ({
	value,
	onCommit,
	suppressManualScrollRestore,
	onBlur,
	onCompositionEnd,
	onCompositionStart,
	onFocus,
	onKeyDown,
	disabled,
	readOnly,
	...props
}) => {
	const {
		draftValue,
		setDraftValue,
		flushValue,
		setIsComposing,
		setIsFocused,
		isComposingRef,
	} = useBufferedFieldValue({
		value,
		onCommit,
		disabled,
		readOnly,
	});

	return (
		<Textarea
			{...props}
			value={draftValue}
			disabled={disabled}
			readOnly={readOnly}
			onChange={(event) => setDraftValue(event.target.value)}
			onCompositionStart={(event) => {
				isComposingRef.current = true;
				setIsComposing(true);
				onCompositionStart?.(event);
			}}
			onCompositionEnd={(event) => {
				isComposingRef.current = false;
				setIsComposing(false);
				setDraftValue(event.currentTarget.value);

				if (
					!document.hasFocus() ||
					document.activeElement !== event.currentTarget
				) {
					flushValue();
				}

				onCompositionEnd?.(event);
			}}
			onFocus={(event) => {
				setIsFocused(true);
				onFocus?.(event);
			}}
			onBlur={(event) => {
				setIsFocused(false);

				if (!isComposingRef.current && !isNativeComposing(event.nativeEvent)) {
					if (
						suppressManualScrollRestore &&
						shouldTreatBlurTargetAsNativeSelect(event.relatedTarget)
					) {
						suppressManualScrollRestore(flushValue);
					} else {
						flushValue();
					}
				}

				onBlur?.(event);
			}}
			onKeyDown={(event) => {
				if (
					event.key === "Enter" &&
					(event.ctrlKey || event.metaKey) &&
					!isComposingRef.current &&
					!isNativeComposing(event.nativeEvent)
				) {
					event.preventDefault();
					flushValue();
					focusNextCdsEditableControl(event.currentTarget);
				}

				onKeyDown?.(event);
			}}
		/>
	);
};

const ClassicOptionSelect: React.FC<ClassicOptionSelectProps> = ({
	fieldKey,
	value,
	options,
	onValueChange,
	disabled,
	disabledReason,
	className,
	triggerClassName,
	disabledFieldClassName,
	placeholder,
	onOpenLookupDialog,
	showSearchButton,
}) => {
	const normalizedValue = value.trim();
	const matchedSelectedOption = findClassicSelectedOption(
		options,
		normalizedValue,
	);
	const resolvedValue = getClassicResolvedValue(
		normalizedValue,
		matchedSelectedOption,
	);
	const resolvedOptions =
		resolvedValue && !options.some((option) => option.value === resolvedValue)
			? [{ value: resolvedValue, label: normalizedValue }, ...options]
			: options;
	const placeholderText = placeholder?.trim() ?? "";
	const selectedOptionTitle = matchedSelectedOption
		? getClassicOptionDisplayLabel(matchedSelectedOption)
		: undefined;
	const selectedDisplayValue = resolvedValue || placeholderText;
	const canShowSearchButton =
		Boolean(showSearchButton) && Boolean(onOpenLookupDialog);
	const renderedOptions = useMemo(
		() =>
			resolvedOptions.map((option) => {
				const displayLabel = getClassicOptionDisplayLabel(option);
				return (
					<option
						key={`classic-select-${option.value}`}
						value={option.value}
						title={displayLabel}
						style={{ color: "rgb(15 23 42)" }}
					>
						{displayLabel}
					</option>
				);
			}),
		[resolvedOptions],
	);

	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center",
				canShowSearchButton && CLASSIC_COMPOUND_CONTROL_GAP_CLS,
			)}
		>
			<div className="relative min-w-0 flex-1">
				<select
					value={resolvedValue}
					onPointerDown={markPendingNativeSelectInteraction}
					onChange={(event) => {
						onValueChange(event.target.value ? event.target.value : null);
						finalizeNativeSelectInteraction();
					}}
					onBlur={finalizeNativeSelectInteraction}
					disabled={disabled}
					title={disabledReason ?? selectedOptionTitle}
					className={cn(
						CLASSIC_SELECT_CONTROL_CLS,
						CLASSIC_SELECT_TRIGGER_ONLY_CLS,
						triggerClassName,
						"py-0",
						disabled && disabledFieldClassName,
						className,
					)}
				>
					<option value="">{placeholderText || " "}</option>
					{renderedOptions}
				</select>
				<span
					className={cn(
						"pointer-events-none absolute inset-y-px left-px right-[20px] flex items-center overflow-hidden px-1 text-[11px] leading-[20px] text-slate-900",
						!selectedDisplayValue && "text-slate-400",
						disabled && "text-black",
					)}
				>
					<span className="block truncate">{selectedDisplayValue}</span>
				</span>
				<ClassicSelectCaret disabled={disabled} />
			</div>
			{canShowSearchButton ? (
				<button
					type="button"
					disabled={disabled}
					title={disabledReason ?? "Tìm nhanh trong danh sách"}
					onMouseDown={preventLookupButtonFocusShift}
					onClick={(event) => {
						stopCdsInteraction(event);
						markCdsFocusAnchor(event.currentTarget);
						onOpenLookupDialog?.(fieldKey);
					}}
					className={cn(
						CLASSIC_PICKER_BUTTON_CLS,
						"border border-[#8a8a8a] bg-[#d9d9d9] text-[#1f4a75] hover:bg-[#ececec]",
						disabled && disabledFieldClassName,
					)}
				>
					...
				</button>
			) : null}
		</div>
	);
};

export const ClassicInput: React.FC<ClassicInputProps> = ({
	fieldKey,
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	getLookupOptionsForField,
	resolveFieldLockState,
	usesManualLookupPicker,
	openLookupDialogForField,
	ecusClassicInputCls,
	ecusClassicSelectCls,
	ecusDisabledFieldCls,
	className,
	placeholder,
	lockOptions,
	maxLength,
}) => {
	const { disabledReason, isDisabled } = resolveFieldLockState(
		fieldKey,
		lockOptions,
	);
	const options = getLookupOptionsForField(fieldKey);
	const fieldValue = getFieldStringValue(data[fieldKey]);

	if (options.length > 0 && !usesManualLookupPicker(fieldKey)) {
		const showSearchButton =
			options.length >= CLASSIC_SEARCHABLE_OPTION_THRESHOLD;
		return (
			<ClassicOptionSelect
				fieldKey={fieldKey}
				value={fieldValue}
				options={options}
				onValueChange={(value) => handleFieldChange(fieldKey as string, value)}
				disabled={isDisabled}
				disabledReason={disabledReason}
				className={className}
				triggerClassName={ecusClassicSelectCls}
				disabledFieldClassName={ecusDisabledFieldCls}
				placeholder={placeholder}
				showSearchButton={showSearchButton}
				onOpenLookupDialog={openLookupDialogForField}
			/>
		);
	}

	const handlePaste =
		maxLength && !isDisabled
			? (event: React.ClipboardEvent<HTMLInputElement>) => {
					const pastedText = event.clipboardData.getData("text");
					const normalizedPastedText = pastedText
						.replace(/\r?\n+/g, " ")
						.replace(/\s+/g, " ")
						.trim();

					if (
						normalizedPastedText &&
						Array.from(normalizedPastedText).length > maxLength
					) {
						event.preventDefault();
						handleFieldChange(fieldKey as string, normalizedPastedText);
					}
				}
			: undefined;

	return (
		<BufferedInput
			value={fieldValue}
			onCommit={(nextValue) => handleFieldChange(fieldKey as string, nextValue)}
			suppressManualScrollRestore={suppressManualScrollRestore}
			disabled={isDisabled}
			placeholder={placeholder}
			maxLength={maxLength}
			onPaste={handlePaste}
			title={disabledReason ?? undefined}
			className={cn(
				ecusClassicInputCls,
				isDisabled && ecusDisabledFieldCls,
				className,
			)}
		/>
	);
};

export const ClassicReadonlyInput: React.FC<{
	value: string | null | undefined;
	className?: string;
	ecusClassicReadonlyCls: string;
}> = ({ value, className, ecusClassicReadonlyCls }) => (
	<Input
		value={value ?? ""}
		readOnly
		tabIndex={-1}
		className={cn(ecusClassicReadonlyCls, className)}
	/>
);

export const ClassicSelect: React.FC<ClassicInputProps> = ({
	fieldKey,
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	getLookupOptionsForField,
	resolveFieldLockState,
	ecusClassicInputCls,
	ecusClassicSelectCls,
	ecusDisabledFieldCls,
	className,
	lockOptions,
	displayMode = "code-and-description",
}) => {
	const { disabledReason, isDisabled } = resolveFieldLockState(
		fieldKey,
		lockOptions,
	);
	const options = getLookupOptionsForField(fieldKey);
	const fieldValue = getFieldStringValue(data[fieldKey]);
	const normalizedValue = fieldValue.trim();
	const matchedSelectedOption = findClassicSelectedOption(
		options,
		normalizedValue,
	);
	const resolvedValue = getClassicResolvedValue(
		normalizedValue,
		matchedSelectedOption,
	);
	const selectValue = options.some((option) => option.value === resolvedValue)
		? resolvedValue
		: "";
	const selectedOptionTitle = matchedSelectedOption
		? getClassicOptionDisplayLabel(matchedSelectedOption)
		: undefined;
	const selectedDescription = matchedSelectedOption
		? getClassicOptionDescription(matchedSelectedOption)
		: stripClassicCodePrefix(normalizedValue, resolvedValue);
	const isCodeOnlyDisplay = displayMode === "code-only";
	const visibleSelectValue = isCodeOnlyDisplay ? selectValue : "";
	const codeWidthClassName = getClassicCodeWidthClass(
		fieldKey,
		resolvedValue,
		options,
		displayMode,
	);
	const codeInputClassName = isCodeOnlyDisplay
		? "min-w-0 flex-1"
		: codeWidthClassName;
	const controlSlotClassName = isCodeOnlyDisplay
		? "w-[18px] shrink-0"
		: "min-w-0 flex-1";
	const renderedOptions = useMemo(
		() =>
			options.map((option) => {
				const displayLabel = getClassicOptionDisplayLabel(option);
				return (
					<option
						key={`${fieldKey}-classic-select-${option.value}`}
						value={option.value}
						title={displayLabel}
						style={{ color: "rgb(15 23 42)" }}
					>
						{displayLabel}
					</option>
				);
			}),
		[fieldKey, options],
	);

	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center",
				CLASSIC_COMPOUND_CONTROL_GAP_CLS,
			)}
		>
			<BufferedInput
				value={resolvedValue}
				onCommit={(nextValue) => {
					const normalizedInput = nextValue.trim();
					if (!normalizedInput) {
						handleFieldChange(fieldKey as string, null);
						return;
					}

					if (REVERSE_LOOKUP_BY_LABEL_FIELDS.has(fieldKey)) {
						const matchedByText = findClassicOptionBySearchText(
							options,
							normalizedInput,
						);
						if (matchedByText) {
							handleFieldChange(fieldKey as string, matchedByText.value);
							return;
						}
					}

					handleFieldChange(fieldKey as string, normalizedInput);
				}}
				suppressManualScrollRestore={suppressManualScrollRestore}
				disabled={isDisabled}
				title={disabledReason ?? selectedOptionTitle}
				className={cn(
					ecusClassicInputCls,
					isCodeOnlyDisplay ? "min-w-0 flex-1" : "shrink-0",
					isCodeOnlyDisplay
						? CLASSIC_CODE_ONLY_INPUT_ACCENT_CLS
						: CLASSIC_CODE_INPUT_ACCENT_CLS,
					isDisabled && ecusDisabledFieldCls,
					codeInputClassName,
				)}
			/>
			<div className={cn("relative", controlSlotClassName)}>
				<select
					value={visibleSelectValue}
					onPointerDown={markPendingNativeSelectInteraction}
					onChange={(event) => {
						handleFieldChange(
							fieldKey as string,
							event.target.value ? event.target.value : null,
						);
						finalizeNativeSelectInteraction();
					}}
					onBlur={finalizeNativeSelectInteraction}
					disabled={isDisabled}
					title={disabledReason ?? selectedOptionTitle}
					className={cn(
						CLASSIC_SELECT_CONTROL_CLS,
						isCodeOnlyDisplay && CLASSIC_SELECT_TRIGGER_ONLY_CLS,
						ecusClassicSelectCls,
						"min-w-0 text-ellipsis overflow-hidden",
						isDisabled && ecusDisabledFieldCls,
						className,
					)}
				>
					<option value="">
						{isCodeOnlyDisplay ? " " : selectedDescription || " "}
					</option>
					{renderedOptions}
				</select>
				<ClassicSelectCaret disabled={isDisabled} />
			</div>
		</div>
	);
};

export interface ClassicCodeLookupSelectProps extends CdsClassicUiProps {
	fieldKey: keyof FollowUpCdsInfoRow;
	codeWidthClassName?: string;
	selectClassName?: string;
	wrapperClassName?: string;
	showButton?: boolean;
	lockOptions?: FieldRenderLockOptions;
}

export const ClassicCodeLookupSelect: React.FC<
	ClassicCodeLookupSelectProps
> = ({
	fieldKey,
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	getLookupOptionsForField,
	resolveFieldLockState,
	openLookupDialogForField,
	getLookupDescription,
	ecusClassicInputCls,
	ecusClassicSelectCls,
	ecusClassicButtonCls,
	ecusDisabledFieldCls,
	ecusDisabledButtonCls,
	codeWidthClassName,
	selectClassName,
	wrapperClassName,
	showButton = true,
	lockOptions,
}) => {
	const { disabledReason, isDisabled } = resolveFieldLockState(
		fieldKey,
		lockOptions,
	);
	const options = getLookupOptionsForField(fieldKey);
	const hasLookupOptions = options.length > 0;
	const description = getLookupDescription(fieldKey);
	const fieldValue =
		data[fieldKey] === null || data[fieldKey] === undefined
			? ""
			: String(data[fieldKey]);
	const normalizedValue = fieldValue.trim();
	const matchedSelectedOption = findClassicSelectedOption(
		options,
		normalizedValue,
	);
	const resolvedValue = getClassicResolvedValue(
		normalizedValue,
		matchedSelectedOption,
	);
	const selectValue = options.some((option) => option.value === resolvedValue)
		? resolvedValue
		: "";
	const selectedOption =
		options.find((option) => option.value === selectValue) ?? null;
	const selectedDescription = selectedOption
		? getClassicOptionDescription(selectedOption)
		: stripClassicCodePrefix(normalizedValue, resolvedValue);
	const selectedOptionTitle = selectedOption
		? getClassicOptionDisplayLabel(selectedOption)
		: undefined;
	const resolvedCodeWidthClassName =
		codeWidthClassName ??
		getClassicCodeWidthClass(fieldKey, resolvedValue, options);
	const resolvedSelectClassName = selectClassName ?? "min-w-0 flex-1";
	const renderedOptions = useMemo(
		() =>
			options.map((option) => {
				const displayLabel = getClassicOptionDisplayLabel(option);
				return (
					<option
						key={`${fieldKey}-opt-${option.value}`}
						value={option.value}
						title={displayLabel}
					>
						{displayLabel}
					</option>
				);
			}),
		[fieldKey, options],
	);

	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center",
				CLASSIC_COMPOUND_CONTROL_GAP_CLS,
				wrapperClassName,
			)}
		>
			<BufferedInput
				value={resolvedValue}
				onCommit={(nextValue) =>
					handleFieldChange(
						fieldKey as string,
						nextValue.trim() === "" ? null : nextValue.trim(),
					)
				}
				suppressManualScrollRestore={suppressManualScrollRestore}
				disabled={isDisabled}
				title={disabledReason ?? selectedOptionTitle}
				className={cn(
					ecusClassicInputCls,
					"shrink-0",
					CLASSIC_CODE_INPUT_ACCENT_CLS,
					isDisabled && ecusDisabledFieldCls,
					resolvedCodeWidthClassName,
				)}
			/>
			<div className={cn("relative", resolvedSelectClassName)}>
				<select
					value=""
					onPointerDown={markPendingNativeSelectInteraction}
					onChange={(e) => {
						handleFieldChange(fieldKey as string, e.target.value || null);
						finalizeNativeSelectInteraction();
					}}
					onBlur={finalizeNativeSelectInteraction}
					disabled={isDisabled}
					title={disabledReason ?? selectedOptionTitle}
					className={cn(
						CLASSIC_SELECT_CONTROL_CLS,
						ecusClassicSelectCls,
						"min-w-0 text-ellipsis overflow-hidden",
						isDisabled && ecusDisabledFieldCls,
					)}
				>
					<option value="">{selectedDescription || description}</option>
					{renderedOptions}
				</select>
				<ClassicSelectCaret disabled={isDisabled} />
			</div>
			{showButton && (
				<button
					type="button"
					disabled={isDisabled || !hasLookupOptions}
					title={
						disabledReason ??
						(!hasLookupOptions ? "Chưa có danh mục để chọn" : undefined)
					}
					onMouseDown={preventLookupButtonFocusShift}
					onClick={(event) => {
						stopCdsInteraction(event);
						markCdsFocusAnchor(event.currentTarget);
						openLookupDialogForField(fieldKey);
					}}
					className={cn(
						ecusClassicButtonCls,
						CLASSIC_PICKER_BUTTON_CLS,
						(isDisabled || !hasLookupOptions) && ecusDisabledButtonCls,
					)}
				>
					...
				</button>
			)}
		</div>
	);
};

export interface ClassicLookupCodeAndNameProps extends CdsClassicUiProps {
	fieldKey: keyof FollowUpCdsInfoRow;
	displayField?: keyof FollowUpCdsInfoRow;
	codeWidthClassName?: string;
	buttonLabel?: string;
	hideButton?: boolean;
	namePlaceholder?: string;
}

export const ClassicLookupCodeAndName: React.FC<
	ClassicLookupCodeAndNameProps
> = ({
	fieldKey,
	displayField,
	data,
	handleFieldChange,
	suppressManualScrollRestore,
	getLookupOptionsForField,
	getInitialEntryLockReason,
	openLookupDialogForField,
	getLookupDescription,
	ecusClassicInputCls,
	ecusClassicReadonlyCls,
	ecusClassicButtonCls,
	ecusDisabledFieldCls,
	ecusDisabledButtonCls,
	codeWidthClassName,
	buttonLabel,
	hideButton,
	namePlaceholder,
}) => {
	const disabledReason = getInitialEntryLockReason(fieldKey);
	const isDisabled = disabledReason !== null;
	const lookupOptions = getLookupOptionsForField(fieldKey);
	const fieldValue =
		data[fieldKey] === null || data[fieldKey] === undefined
			? ""
			: String(data[fieldKey]);
	const matchedSelectedOption = findClassicSelectedOption(
		lookupOptions,
		fieldValue.trim(),
	);
	const resolvedValue = getClassicResolvedValue(
		fieldValue.trim(),
		matchedSelectedOption,
	);
	const displayFieldValue = displayField
		? stripClassicCodePrefix(data[displayField], resolvedValue)
		: "";
	const selectedOptionTitle = matchedSelectedOption
		? getClassicOptionDisplayLabel(matchedSelectedOption)
		: undefined;
	const resolvedCodeWidthClassName =
		codeWidthClassName ??
		getClassicCodeWidthClass(fieldKey, resolvedValue, lookupOptions);

	return (
		<div
			className={cn(
				"flex w-full min-w-0 items-center",
				CLASSIC_COMPOUND_CONTROL_GAP_CLS,
			)}
		>
			<div className={cn("shrink-0", resolvedCodeWidthClassName)}>
				<BufferedInput
					value={resolvedValue}
					onCommit={(nextValue) =>
						handleFieldChange(fieldKey as string, nextValue)
					}
					suppressManualScrollRestore={suppressManualScrollRestore}
					disabled={isDisabled}
					title={disabledReason ?? selectedOptionTitle}
					className={cn(
						ecusClassicInputCls,
						CLASSIC_CODE_INPUT_ACCENT_CLS,
						isDisabled && ecusDisabledFieldCls,
					)}
				/>
			</div>
			<div className="min-w-0 flex-1">
				{displayField ? (
					<BufferedInput
						value={displayFieldValue}
						onCommit={(nextValue) =>
							handleFieldChange(
								displayField as string,
								stripClassicCodePrefix(nextValue, resolvedValue),
							)
						}
						suppressManualScrollRestore={suppressManualScrollRestore}
						disabled={isDisabled}
						placeholder={namePlaceholder}
						title={disabledReason ?? undefined}
						className={cn(
							ecusClassicInputCls,
							isDisabled && ecusDisabledFieldCls,
						)}
					/>
				) : (
					<Input
						value={getLookupDescription(fieldKey)}
						readOnly
						tabIndex={-1}
						className={cn(ecusClassicReadonlyCls)}
					/>
				)}
			</div>
			{hideButton ? null : (
				<button
					type="button"
					onMouseDown={preventLookupButtonFocusShift}
					onClick={(event) => {
						stopCdsInteraction(event);
						markCdsFocusAnchor(event.currentTarget);
						openLookupDialogForField(fieldKey);
					}}
					disabled={isDisabled || lookupOptions.length === 0}
					title={disabledReason ?? undefined}
					className={cn(
						ecusClassicButtonCls,
						CLASSIC_PICKER_BUTTON_CLS,
						(isDisabled || lookupOptions.length === 0) && ecusDisabledButtonCls,
					)}
				>
					{buttonLabel ?? "..."}
				</button>
			)}
		</div>
	);
};

export interface ClassicLookupPickerButtonProps extends CdsClassicUiProps {
	fieldKey: keyof FollowUpCdsInfoRow;
	buttonLabel?: string;
	className?: string;
	displayField?: keyof FollowUpCdsInfoRow;
	lockOptions?: FieldRenderLockOptions;
}

export const ClassicLookupPickerButton: React.FC<
	ClassicLookupPickerButtonProps
> = ({
	fieldKey,
	getLookupOptionsForField,
	resolveFieldLockState,
	openLookupDialogForField,
	ecusClassicButtonCls,
	ecusDisabledButtonCls,
	buttonLabel,
	className,
	lockOptions,
}) => {
	const hasLookupOptions = getLookupOptionsForField(fieldKey).length > 0;
	const { disabledReason, isDisabled } = resolveFieldLockState(
		fieldKey,
		lockOptions,
	);

	return (
		<button
			type="button"
			onMouseDown={preventLookupButtonFocusShift}
			onClick={(event) => {
				stopCdsInteraction(event);
				markCdsFocusAnchor(event.currentTarget);
				openLookupDialogForField(fieldKey);
			}}
			disabled={isDisabled || !hasLookupOptions}
			title={disabledReason ?? undefined}
			className={cn(
				ecusClassicButtonCls,
				CLASSIC_PICKER_BUTTON_CLS,
				(isDisabled || !hasLookupOptions) && ecusDisabledButtonCls,
				className,
			)}
		>
			{buttonLabel ?? "..."}
		</button>
	);
};
