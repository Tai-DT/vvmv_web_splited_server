import type { CargoListRow } from "@/app/(home)/internal/followup/types";
import { isCargoCustomCodeRequiredForOperationCode } from "@/lib/followup/cargo-custom-code-rules";

export type CargoPanelValidationIssue = {
	path: string;
	severity: "error" | "warning" | "info";
	message: string;
	suggestions?: string[];
};

const META_KEYS = new Set(["id", "followUpId", "createdAt", "updatedAt"]);

const NEGATIVE_NUMBER_FIELDS: Array<{
	key: keyof CargoListRow;
	label: string;
}> = [
	{ key: "qty", label: "Lượng" },
	{ key: "packageQty", label: "Số kiện" },
	{ key: "grossWeight", label: "G.W" },
	{ key: "unitPrice", label: "Đơn giá hóa đơn" },
	{ key: "totalPrice", label: "Trị giá hóa đơn" },
	{ key: "lineTaxableValue", label: "Trị giá tính thuế" },
	{ key: "exportTaxRatePercent", label: "TS XK(%)" },
	{ key: "exportTaxAmount", label: "Tiền thuế XK" },
	{ key: "taxableUnitPrice", label: "Đơn giá tính thuế" },
	{ key: "qty2", label: "Lượng 2" },
];

function hasText(value: unknown): boolean {
	return typeof value === "string" ? value.trim().length > 0 : false;
}

function toFiniteNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function isValidCalendarDateParts(
	year: number,
	month: number,
	day: number,
): boolean {
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function isValidDateLike(value: string): boolean {
	const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		return isValidCalendarDateParts(
			Number(isoMatch[1]),
			Number(isoMatch[2]),
			Number(isoMatch[3]),
		);
	}

	const displayMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (displayMatch) {
		return isValidCalendarDateParts(
			Number(displayMatch[3]),
			Number(displayMatch[2]),
			Number(displayMatch[1]),
		);
	}

	return !Number.isNaN(Date.parse(value));
}

export function isCargoRowEffectivelyEmpty(
	row: Partial<CargoListRow>,
): boolean {
	return !Object.entries(row).some(([key, value]) => {
		if (META_KEYS.has(key)) {
			return false;
		}

		if (typeof value === "string") {
			return value.trim() !== "";
		}

		if (typeof value === "number") {
			return value !== 0;
		}

		return value !== null && value !== undefined;
	});
}

export function buildCargoListClientIssues(
	rows: Partial<CargoListRow>[],
	options: { operationCode?: unknown } = {},
): CargoPanelValidationIssue[] {
	const issues: CargoPanelValidationIssue[] = [];
	const isCustomCodeRequired = isCargoCustomCodeRequiredForOperationCode(
		options.operationCode,
	);

	rows.forEach((row, index) => {
		if (isCargoRowEffectivelyEmpty(row)) {
			return;
		}

		if (isCustomCodeRequired && !hasText(row.customCode)) {
			issues.push({
				path: `cargoList[${index}].customCode`,
				severity: "warning",
				message: "Mã hàng đang trống.",
			});
		}

		if (!hasText(row.vietnameseName) && !hasText(row.originalCargoName)) {
			issues.push({
				path: `cargoList[${index}].vietnameseName`,
				severity: "warning",
				message: "Thiếu tên hàng. Cần có Tên hàng hoặc Tên hàng trên chứng từ.",
			});
		}

		for (const field of NEGATIVE_NUMBER_FIELDS) {
			const numericValue = toFiniteNumber(row[field.key]);
			if (numericValue !== null && numericValue < 0) {
				issues.push({
					path: `cargoList[${index}].${String(field.key)}`,
					severity: "error",
					message: `${field.label} không được âm.`,
				});
			}
		}

		const qty = toFiniteNumber(row.qty);
		const unitPrice = toFiniteNumber(row.unitPrice);
		const totalPrice = toFiniteNumber(row.totalPrice);
		if (qty !== null && qty > 0 && !hasText(row.unit)) {
			issues.push({
				path: `cargoList[${index}].unit`,
				severity: "warning",
				message: "Có Lượng nhưng chưa có Đơn vị tính.",
			});
		}

		const packageQty = toFiniteNumber(row.packageQty);
		if (packageQty !== null && packageQty > 0 && !hasText(row.packageType)) {
			issues.push({
				path: `cargoList[${index}].packageType`,
				severity: "warning",
				message: "Có Số kiện nhưng chưa có Loại kiện.",
			});
		}

		const hasInvoiceNo = hasText(row.invoiceNo);
		const hasInvoiceDate = hasText(row.invoiceDate);
		const hasInvoiceValue =
			(unitPrice !== null && unitPrice > 0) ||
			(totalPrice !== null && totalPrice > 0);

		if (hasInvoiceValue && !hasInvoiceNo) {
			issues.push({
				path: `cargoList[${index}].invoiceNo`,
				severity: "warning",
				message: "Có dữ liệu giá hóa đơn nhưng chưa có Inv No.",
			});
		}

		if (hasInvoiceNo && !hasInvoiceDate) {
			issues.push({
				path: `cargoList[${index}].invoiceDate`,
				severity: "warning",
				message: "Có Inv No nhưng chưa có Inv Date.",
			});
		}

		if (!hasInvoiceNo && hasInvoiceDate) {
			issues.push({
				path: `cargoList[${index}].invoiceNo`,
				severity: "warning",
				message: "Có Inv Date nhưng chưa có Inv No.",
			});
		}

		if (
			(unitPrice !== null && unitPrice > 0) ||
			(totalPrice !== null && totalPrice > 0)
		) {
			if (qty === null || qty <= 0) {
				issues.push({
					path: `cargoList[${index}].qty`,
					severity: "warning",
					message: "Có đơn giá hoặc trị giá nhưng chưa có Lượng hợp lệ.",
				});
			}
		}

		if (qty !== null && qty > 0 && totalPrice !== null && totalPrice > 0) {
			if (unitPrice === null || unitPrice <= 0) {
				issues.push({
					path: `cargoList[${index}].unitPrice`,
					severity: "warning",
					message: "Có Lượng và Trị giá hóa đơn nhưng chưa có Đơn giá hóa đơn.",
				});
			}
		}

		if (qty !== null && qty > 0 && unitPrice !== null && unitPrice > 0) {
			if (totalPrice === null || totalPrice <= 0) {
				issues.push({
					path: `cargoList[${index}].totalPrice`,
					severity: "warning",
					message: "Có Lượng và Đơn giá hóa đơn nhưng chưa có Trị giá hóa đơn.",
				});
			}
		}

		if (hasText(row.invoiceDate) && !isValidDateLike(String(row.invoiceDate))) {
			issues.push({
				path: `cargoList[${index}].invoiceDate`,
				severity: "warning",
				message: "Ngày hóa đơn chưa đúng định dạng ngày hợp lệ.",
			});
		}
	});

	return issues;
}
