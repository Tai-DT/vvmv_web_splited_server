import { FOLLOWUP_LABELS } from "@/app/(home)/internal/followup/_components/table/column-labels";
import type { FollowUpRow } from "@/app/(home)/internal/followup/types";

export interface ValidationError {
	field: string;
	message: string;
}

// Bot action types
export const BOT_ACTIONS = {
	FAST_INPUT: "FAST Input",
	DRAFT_CDS: "Draft CDS",
	FAST_CDS: "FAST CDS",
	FAST_CO: "FAST CO",
	TRUCKING_REQUEST: "Trucking Request",
	CSHT_REQUEST: "CSHT Request",
	TAX_REQUEST: "TAX Request",
	LPHQ_REQUEST: "LPHQ Request",
	FAST_FINISH: "FAST Finish",
	FAST_UNFINISH: "FAST Un-Finish",
	CHECK_QUA_KVGS: "Check Qua KVGS & TQ",
	CHECK_CDS_ATTACHMENT: "Check CDS Attachment",
} as const;

export type BotActionType = (typeof BOT_ACTIONS)[keyof typeof BOT_ACTIONS];

/**
 * Check if CBM is required based on service_mode and cargo_type
 * CBM can be empty when:
 * - service_mode contains "TC" OR "FCL" OR "CPN" OR "DBO" OR "AIR"
 * - OR cargo_type = "NHAP"
 */
function isCbmRequired(row: FollowUpRow): boolean {
	const serviceMode = row.serviceMode?.toUpperCase() || "";
	const operationType = row.operationType?.toUpperCase() || "";

	// CBM not required if cargo type or operation type is NHAP
	if (operationType === "NHAP") {
		return false;
	}

	// CBM not required if service mode contains these keywords
	const exemptKeywords = ["TC", "FCL", "CPN", "DBO", "AIR"];
	const isExempt = exemptKeywords.some((keyword) =>
		serviceMode.includes(keyword),
	);

	return !isExempt; // Required if NOT exempt
}

/**
 * Check if containers are required based on service_mode
 * Containers required when service_mode contains "FCL"
 */
function isContainersRequired(row: FollowUpRow): boolean {
	const serviceMode = row.serviceMode?.toUpperCase() || "";
	return serviceMode.includes("FCL");
}

/**
 * Validate FollowUp row for FAST Input action
 * Checks all required fields
 */
export function validateForFastInput(row: FollowUpRow): ValidationError[] {
	const errors: ValidationError[] = [];
	const jobNumber = row.jobNumber || "";
	const _serviceMode = row.serviceMode?.toUpperCase() || "";
	const _operationType = row.operationType?.toUpperCase() || "";

	// Always required fields
	if (!row.operationType) {
		errors.push({
			field: "operationType",
			message: `${FOLLOWUP_LABELS.operationType} is required`,
		});
	}

	if (!row.taxCode) {
		errors.push({
			field: "taxCode",
			message: `${FOLLOWUP_LABELS.taxCode} is required`,
		});
	}

	if (!row.serviceMode) {
		errors.push({
			field: "serviceMode",
			message: `${FOLLOWUP_LABELS.serviceMode} is required`,
		});
	}

	if (!row.cargoType && jobNumber.includes("HCM")) {
		errors.push({
			field: "cargoType",
			message: `${FOLLOWUP_LABELS.cargoType} is required`,
		});
	}

	if (!row.authority) {
		errors.push({
			field: "authority",
			message: `${FOLLOWUP_LABELS.authority} is required`,
		});
	}

	if (row.quantity === undefined || row.quantity === null) {
		errors.push({
			field: "quantity",
			message: `${FOLLOWUP_LABELS.quantity} is required`,
		});
	} else if (row.quantity < 0) {
		errors.push({
			field: "quantity",
			message: `${FOLLOWUP_LABELS.quantity} must not be less than 0`,
		});
	}

	if (!row.unit) {
		errors.push({
			field: "unit",
			message: `${FOLLOWUP_LABELS.unit} is required`,
		});
	}

	if (row.grossWeight === undefined || row.grossWeight === null) {
		errors.push({
			field: "grossWeight",
			message: `${FOLLOWUP_LABELS.grossWeight} is required`,
		});
	} else if (row.grossWeight < 0) {
		errors.push({
			field: "grossWeight",
			message: `${FOLLOWUP_LABELS.grossWeight} must not be less than 0`,
		});
	}

	if (!row.invoice) {
		errors.push({
			field: "invoice",
			message: `${FOLLOWUP_LABELS.invoice} is required`,
		});
	}

	// Conditional validation: CBM
	if (isCbmRequired(row) && (row.cbm === undefined || row.cbm === null)) {
		errors.push({
			field: "cbm",
			message: `${FOLLOWUP_LABELS.cbm} is required`,
		});
	} else if (isCbmRequired(row) && row.cbm && row.cbm < 0) {
		errors.push({
			field: "cbm",
			message: `${FOLLOWUP_LABELS.cbm} must not be less than 0`,
		});
	}

	// Conditional validation: Containers
	if (isContainersRequired(row)) {
		if (!row.containers || row.containers.length === 0) {
			errors.push({
				field: "containers",
				message: "At least one container is required for FCL shipment",
			});
		} else {
			// Validate container data completeness
			const _invalidContainers = row.containers.some(
				(container) => !container.containerNo || !container.sealNo,
			);

			// if (invalidContainers) {
			//   errors.push({
			//     field: "containers",
			//     message: "All containers must have Container No. and Seal No.",
			//   });
			// }
		}
	}

	return errors;
}

/**
 * Validate FollowUp row for FAST CDS action
 * Checks if drive URL exists (actual file check happens on server)
 */
export function validateForFastCDS(row: FollowUpRow): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!row.driveUrl) {
		errors.push({
			field: "driveUrl",
			message: "Drive URL is required - files must be uploaded first",
		});
	}

	return errors;
}

/**
 * Validate FollowUp row for CSHT Request action
 * Checks if drive URL exists (actual file check happens on server)
 */
export function validateForCSHTRequest(row: FollowUpRow): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!row.driveUrl) {
		errors.push({
			field: "driveUrl",
			message: "Drive URL is required - files must be uploaded first",
		});
	}

	return errors;
}

/**
 * Validate FollowUp row for TAX Request action
 * Checks if drive URL exists (actual file check happens on server)
 */
export function validateForTAXRequest(row: FollowUpRow): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!row.driveUrl) {
		errors.push({
			field: "driveUrl",
			message: "Drive URL is required - files must be uploaded first",
		});
	}

	return errors;
}

/**
 * Validate FollowUp row for LPHQ Request action
 * Checks if drive URL exists (actual file check happens on server)
 */
export function validateForLPHQRequest(row: FollowUpRow): ValidationError[] {
	const errors: ValidationError[] = [];

	if (!row.driveUrl) {
		errors.push({
			field: "driveUrl",
			message: "Drive URL is required - files must be uploaded first",
		});
	}

	return errors;
}

/**
 * Check if bill_or_booking is required based on service_mode and cargo_type
 * bill_or_booking can be empty when:
 * - service_mode is "TC" OR "KNQ"
 * - OR cargo_type = "XUAT"
 */
function isBillOrBookingRequired(row: FollowUpRow): boolean {
	const serviceMode = row.serviceMode?.toUpperCase() || "";
	const operationType = row.operationType?.toUpperCase() || "";

	// bill_or_booking not required if cargo type or operation type is XUAT
	if (operationType === "XUAT") {
		return false;
	}

	// bill_or_booking not required if service mode contains TC or KNQ
	const exemptKeywords = ["TC", "KNQ"];
	if (exemptKeywords.some((keyword) => serviceMode.includes(keyword))) {
		return false;
	}

	return true; // Required otherwise
}

/**
 * Validate FollowUp row for Trucking Request action
 * Checks required fields: service_mode, cargo_type, bill_or_booking (conditional), Container (conditional)
 */
export function validateForTruckingRequest(
	row: FollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];
	const jobNumber = row.jobNumber || "";
	const operationType = row.operationType?.toUpperCase() || "";

	// Always required fields
	if (!row.serviceMode) {
		errors.push({
			field: "serviceMode",
			message: `${FOLLOWUP_LABELS.serviceMode} is required`,
		});
	}

	if (!row.cargoType && jobNumber.includes("HCM")) {
		errors.push({
			field: "cargoType",
			message: `${FOLLOWUP_LABELS.cargoType} is required`,
		});
	}

	// Domain HAN: pick_up_time is required
	if (row.domain === "HAN" && !row.pickUpTime) {
		errors.push({
			field: "pickUpTime",
			message: `${FOLLOWUP_LABELS.pickUpTime} is required for HAN domain`,
		});
	}

	// Hàng Nhập: warehouse is required
	if (operationType === "NHAP" && !row.warehouse) {
		errors.push({
			field: "warehouse",
			message: `${FOLLOWUP_LABELS.warehouse} is required for import (Nhập)`,
		});
	}

	// Conditional validation: bill_or_booking
	if (isBillOrBookingRequired(row) && !row.billOrBooking) {
		errors.push({
			field: "billOrBooking",
			message: `${FOLLOWUP_LABELS.billOrBooking} is required.`,
		});
	}

	// Conditional validation: Containers
	if (isContainersRequired(row)) {
		if (!row.containers || row.containers.length === 0) {
			errors.push({
				field: "containers",
				message:
					"At least one container is required when service mode contains 'FCL'",
			});
		} else {
			// Validate container data completeness
			const _invalidContainers = row.containers.some(
				(container) => !container.containerNo || !container.sealNo,
			);

			// if (invalidContainers) {
			//   errors.push({
			//     field: "containers",
			//     message: "All containers must have Container No. and Seal No.",
			//   });
			// }
		}
	}

	// Check for successful FAST Input
	const hasSuccessfulFastInput = row.invokerTasks?.some((task) => {
		if (task.task_name !== BOT_ACTIONS.FAST_INPUT) return false;

		const status = task.status?.toUpperCase() || "";
		const message = task.message?.toUpperCase() || "";

		// Match logic from StatusCell: SUCCESS status or Completed with SUCCESS in message
		return (
			status === "SUCCESS" ||
			(status === "COMPLETED" && message.includes("SUCCESS"))
		);
	});

	if (!hasSuccessfulFastInput) {
		errors.push({
			field: "fastInput",
			message:
				"FAST Input must be run with SUCCESS status before Trucking Request",
		});
	}

	return errors;
}

/**
 * Validate FollowUp row based on the bot action
 * Routes to appropriate validation function
 */
export function validateFollowUpForBotAction(
	row: FollowUpRow,
	action: BotActionType,
): ValidationError[] {
	switch (action) {
		case BOT_ACTIONS.FAST_INPUT:
			return validateForFastInput(row);

		case BOT_ACTIONS.FAST_CDS:
			return validateForFastCDS(row);

		case BOT_ACTIONS.CSHT_REQUEST:
			return validateForCSHTRequest(row);

		case BOT_ACTIONS.TAX_REQUEST:
			return validateForTAXRequest(row);

		case BOT_ACTIONS.LPHQ_REQUEST:
			return validateForLPHQRequest(row);

		case BOT_ACTIONS.TRUCKING_REQUEST:
			return validateForTruckingRequest(row);

		// Other actions: no validation for now
		case BOT_ACTIONS.DRAFT_CDS:
		case BOT_ACTIONS.FAST_CO:
		case BOT_ACTIONS.FAST_FINISH:
		case BOT_ACTIONS.FAST_UNFINISH:
		case BOT_ACTIONS.CHECK_QUA_KVGS:
			return []; // No validation for now

		default:
			return [];
	}
}

/**
 * Format validation errors for user display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
	if (errors.length === 0) return "";

	if (errors.length === 1) {
		return errors[0].message;
	}

	return `Missing required fields:\n${errors.map((e) => `• ${e.message}`).join("\n")}`;
}
