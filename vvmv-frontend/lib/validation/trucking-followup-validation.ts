import type { TruckingFollowUpRow } from "@/app/(home)/internal/trucking-followup/types";

export interface ValidationError {
	field: string;
	message: string;
}

// Trucking Bot action types
export const TRUCKING_BOT_ACTIONS = {
	TRUCKING_INPUT: "Trucking Input",
	POD_MAKING: "POD Making",
	EPORT_DECLARATION: "Eport Declaration",
	REGISTER_VESSEL_DEPARTURE: "Vessel Register",
	MAKING_CONTAINER_PACKING: "Making Container Packing",
	FAST_FINISH: "FAST Finish",
	FAST_UNFINISH: "FAST Un-Finish",
} as const;

export const TRUCKING_BULK_ACTIONS = {
	COMBINE_JOB: "Combine Job",
} as const;

export type TruckingBotActionType =
	(typeof TRUCKING_BOT_ACTIONS)[keyof typeof TRUCKING_BOT_ACTIONS];

// Field labels for error messages
const TRUCKING_FOLLOWUP_LABELS: Record<string, string> = {
	// Main table fields - synced from trucking-followup column-labels.ts
	operationType: "Xuất/Nhập",
	serviceMode: "Service Mode",
	taxCode: "Tax Code",
	billOrBooking: "Bill/Booking",
	containers: "Containers",
	declarations: "Declarations",
	fcrs: "FCRs",
	vendor: "Vendor",
	closingTime: "Hạn Lệnh",
	cutOffTime: "Cut-off Time",
	vesselName: "Tên tàu",
	veselNumber: "Số chuyến",
	pickUpTime: "Giờ lấy hàng",
	fromLocation: "Điểm đi",
	toLocation: "Điểm đến",
	eportService: "Dịch vụ Eport",
	eportBooking: "Eport Booking",
	maNhanConmt: "Mã nhận cont",
	soLenh: "Số lệnh",
	implementationDate: "Ngày thực hiện",
	warehouse: "Kho",
	grossWeight: "Gross Weight",
	temperature: "Nhiệt độ",
	ngatDienDate: "Ngày ngắt điện",
	hsCode: "HS Code",
	deliveryContactDetail: "Thông tin liên hệ giao hàng",
	transitPort: "Cảng chuyển tải",
	destinationPort: "Cảng đích",
	donViKhuTrung: "Đơn vị khử trùng",
	commodityName: "Tên hàng",
	invoiceTaxCode: "Mã thuế hóa đơn",
	clientName: "Tên khách hàng",
	carrierName: "Hãng tàu",
	authority: "Cơ quan",
	transactionCode: "Mã Giao Dịch",
	payDate: "Ngày thanh toán",
	// Container table fields - synced from CONTAINER_HEADERS
	containerNo: "Container No",
	sealNo: "Seal No",
	kc: "Kích cỡ",
	containerGrossWeight: "G.W",
	tareWeight: "Tare Weight",
	containerClosingTime: "Hạn lệnh",
	containerVesselName: "Tên tàu",
	vatTaxCode: "Mã số thuế hóa đơn",
};

/**
 * Check if containers are required based on service_mode
 * Containers required when service_mode contains "FCL"
 */
function isContainersRequired(row: TruckingFollowUpRow): boolean {
	const serviceMode = row.serviceMode?.toUpperCase() || "";
	return serviceMode.includes("FCL");
}

/**
 * Validate TruckingFollowUp row for Trucking Input action
 */
export function validateForTruckingInput(
	row: TruckingFollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// Required: serviceMode
	if (!row.serviceMode) {
		errors.push({
			field: "serviceMode",
			message: `${TRUCKING_FOLLOWUP_LABELS.serviceMode} is required`,
		});
	}

	// Required: operationType
	if (!row.operationType) {
		errors.push({
			field: "operationType",
			message: `${TRUCKING_FOLLOWUP_LABELS.operationType} is required`,
		});
	}

	// Conditional: containers for FCL
	if (isContainersRequired(row)) {
		if (!row.containers || row.containers.length === 0) {
			errors.push({
				field: "containers",
				message: "At least one container is required for FCL shipment",
			});
		}
	}

	// Required: FCRs
	if (!row.fcrs || row.fcrs.length === 0) {
		errors.push({
			field: "fcrs",
			message: "At least one FCR record is required",
		});
	} else {
		// Validate each FCR has vendor and implementationDate
		row.fcrs.forEach((fcr, index) => {
			if (!fcr.vendor) {
				errors.push({
					field: `fcrs[${index}].vendor`,
					message: `FCR #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.vendor} is required`,
				});
			}
			if (!fcr.implementationDate) {
				errors.push({
					field: `fcrs[${index}].implementationDate`,
					message: `FCR #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.implementationDate} is required`,
				});
			}
		});
	}

	return errors;
}

/**
 * Validate TruckingFollowUp row for POD Making action
 */

export function validateForPODMaking(
	row: TruckingFollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// Required: warehouse

	// Required: FCRs
	if (!row.fcrs || row.fcrs.length === 0) {
		errors.push({
			field: "fcrs",
			message: "At least one FCR record is required",
		});
	} else {
		// Validate each FCR has implementationDate
		row.fcrs.forEach((fcr, index) => {
			if (!fcr.implementationDate) {
				errors.push({
					field: `fcrs[${index}].implementationDate`,
					message: `FCR #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.implementationDate} is required`,
				});
			}

			if (!fcr.warehouse) {
				errors.push({
					field: `fcrs[${index}].warehouse`,
					message: `FCR #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.warehouse} is required`,
				});
			}
		});
	}

	return errors;
}

/**
 * Check if any container has kc ending with "30" (e.g. 2230)
 */
function hasContainerWithKc30(row: TruckingFollowUpRow): boolean {
	if (!row.containers || row.containers.length === 0) return false;
	return row.containers.some((c) => {
		const kc = c.kc?.trim() || "";
		return kc.length >= 2 && kc.slice(-2) === "30";
	});
}

/**
 * Validate TruckingFollowUp row for Eport Declaration action
 */
export function validateForEportDeclaration(
	row: TruckingFollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// Only validate if at least one container has noEport: false (or undefined)
	const hasEportContainers = row.containers?.some((c) => !c.noEport);
	if (!hasEportContainers) return [];

	const operationType = row.operationType?.toUpperCase() || "";
	const isXuat = operationType === "XUAT";
	const isNhap = operationType === "NHAP";

	// ============================================================
	// Common rules (both XUAT and NHAP)
	// ============================================================

	// Main table required fields

	if (!row.fromLocation) {
		errors.push({
			field: "fromLocation",
			message: `${TRUCKING_FOLLOWUP_LABELS.fromLocation} is required`,
		});
	}
	if (!row.carrierName) {
		errors.push({
			field: "carrierName",
			message: `${TRUCKING_FOLLOWUP_LABELS.carrierName} is required`,
		});
	}
	if (!row.eportBooking) {
		errors.push({
			field: "eportBooking",
			message: `${TRUCKING_FOLLOWUP_LABELS.eportBooking} is required`,
		});
	}
	if (!row.authority) {
		errors.push({
			field: "authority",
			message: `${TRUCKING_FOLLOWUP_LABELS.authority} is required`,
		});
	}

	// At least 1 container required (common)
	if (!row.containers || row.containers.length === 0) {
		errors.push({
			field: "containers",
			message: "At least one container is required for Eport Declaration",
		});
	} else {
		// Common container validation: vesselName required on every container
		row.containers.forEach((container, index) => {
			if (container.noEport) return;

			if (!container.vesselName) {
				errors.push({
					field: `containers[${index}].vesselName`,
					message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.containerVesselName} is required`,
				});
			}
			if (!container.vatTaxCode) {
				errors.push({
					field: `containers[${index}].vatTaxCode`,
					message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.vatTaxCode} is required`,
				});
			}
		});
	}

	// ============================================================
	// XUAT (Export) specific rules
	// ============================================================
	if (isXuat) {
		// Container field validations for XUAT
		if (row.containers && row.containers.length > 0) {
			row.containers.forEach((container, index) => {
				if (container.noEport) return;

				if (!container.containerNo) {
					errors.push({
						field: `containers[${index}].containerNo`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.containerNo} is required`,
					});
				}
				if (!container.sealNo) {
					errors.push({
						field: `containers[${index}].sealNo`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.sealNo} is required`,
					});
				}
				if (!container.kc) {
					errors.push({
						field: `containers[${index}].kc`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.kc} is required`,
					});
				}
				if (
					container.grossWeight === undefined ||
					container.grossWeight === null
				) {
					errors.push({
						field: `containers[${index}].grossWeight`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.containerGrossWeight} is required`,
					});
				}
				if (
					container.tareWeight === undefined ||
					container.tareWeight === null
				) {
					errors.push({
						field: `containers[${index}].tareWeight`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.tareWeight} is required`,
					});
				}
				if (!container.veselNumber) {
					errors.push({
						field: `containers[${index}].veselNumber`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.veselNumber} is required`,
					});
				}
			});
		}

		// If any container kc ends with "30" → temperature required
		if (
			hasContainerWithKc30(row) &&
			(row.temperature === undefined || row.temperature === null)
		) {
			errors.push({
				field: "temperature",
				message: `${TRUCKING_FOLLOWUP_LABELS.temperature} is required when container kích cỡ ends with 30`,
			});
		}

		// If any container kc ends with "30" AND hàng NHAP → ngatDienDate required
		if (hasContainerWithKc30(row) && isNhap && !row.ngatDienDate) {
			errors.push({
				field: "ngatDienDate",
				message: `${TRUCKING_FOLLOWUP_LABELS.ngatDienDate} is required when container kích cỡ ends with 30 (Nhập)`,
			});
		}

		// Main table required fields for XUAT
		if (!row.hsCode) {
			errors.push({
				field: "hsCode",
				message: `${TRUCKING_FOLLOWUP_LABELS.hsCode} is required`,
			});
		}
		if (!row.deliveryContactDetail) {
			errors.push({
				field: "deliveryContactDetail",
				message: `${TRUCKING_FOLLOWUP_LABELS.deliveryContactDetail} is required`,
			});
		}
		if (!row.transitPort) {
			errors.push({
				field: "transitPort",
				message: `${TRUCKING_FOLLOWUP_LABELS.transitPort} is required`,
			});
		}
		if (!row.destinationPort) {
			errors.push({
				field: "destinationPort",
				message: `${TRUCKING_FOLLOWUP_LABELS.destinationPort} is required`,
			});
		}

		// If eportService has value → donViKhuTrung required
		if (row.eportService && !row.donViKhuTrung) {
			errors.push({
				field: "donViKhuTrung",
				message: `${TRUCKING_FOLLOWUP_LABELS.donViKhuTrung} is required when ${TRUCKING_FOLLOWUP_LABELS.eportService} has a value`,
			});
		}

		// If fromLocation !== "Cát Lái" → commodityName required
		if (
			row.fromLocation &&
			row.fromLocation !== "Cát Lái" &&
			!row.commodityName
		) {
			errors.push({
				field: "commodityName",
				message: `${TRUCKING_FOLLOWUP_LABELS.commodityName} is required when From Location is not "Cát Lái"`,
			});
		}
	}

	// ============================================================
	// NHAP (Import) specific rules
	// ============================================================
	if (isNhap) {
		// At least 1 declaration
		// if (!row.declarations || row.declarations.length === 0) {
		//   errors.push({
		//     field: "declarations",
		//     message: `At least one declaration is required for import (Nhập)`,
		//   });
		// }

		// transactionCode must be empty
		if (row.transactionCode) {
			errors.push({
				field: "transactionCode",
				message: `${TRUCKING_FOLLOWUP_LABELS.transactionCode} must be empty`,
			});
		}

		if (!row.clientName) {
			errors.push({
				field: "clientName",
				message: `${TRUCKING_FOLLOWUP_LABELS.clientName} is required`,
			});
		}

		// Container: closing_time required on every container
		if (row.containers && row.containers.length > 0) {
			row.containers.forEach((container, index) => {
				if (container.noEport) return;

				if (!container.closingTime) {
					errors.push({
						field: `containers[${index}].closingTime`,
						message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.containerClosingTime} is required`,
					});
				}
			});
		}

		// If any container kc ends with "30" → ngatDienDate required
		if (hasContainerWithKc30(row) && !row.ngatDienDate) {
			errors.push({
				field: "ngatDienDate",
				message: `${TRUCKING_FOLLOWUP_LABELS.ngatDienDate} is required when container kích cỡ  ends with 30`,
			});
		}

		// Main table required fields for NHAP
		if (!row.payDate) {
			errors.push({
				field: "payDate",
				message: `${TRUCKING_FOLLOWUP_LABELS.payDate} is required for import (Nhập)`,
			});
		}
		if (!row.maNhanConmt) {
			errors.push({
				field: "maNhanConmt",
				message: `${TRUCKING_FOLLOWUP_LABELS.maNhanConmt} is required for import (Nhập)`,
			});
		}
		if (!row.soLenh) {
			errors.push({
				field: "soLenh",
				message: `${TRUCKING_FOLLOWUP_LABELS.soLenh} is required for import (Nhập)`,
			});
		}
	}

	return errors;
}

/**
 * Validate TruckingFollowUp row for Making Container Packing action
 * Rules:
 *  1. At least one container required
 *  2. Every container must have containerNo and sealNo
 */
export function validateForMakingContainerPacking(
	row: TruckingFollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// 1. At least one container required
	if (!row.containers || row.containers.length === 0) {
		errors.push({
			field: "containers",
			message: "Cần ít nhất một container để Making Container Packing",
		});
	} else {
		// 2. Every container must have containerNo, sealNo, and kc
		row.containers.forEach((container, index) => {
			if (!container.containerNo) {
				errors.push({
					field: `containers[${index}].containerNo`,
					message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.containerNo} là bắt buộc`,
				});
			}
			if (!container.sealNo) {
				errors.push({
					field: `containers[${index}].sealNo`,
					message: `Container #${index + 1}: ${TRUCKING_FOLLOWUP_LABELS.sealNo} là bắt buộc`,
				});
			}
		});
	}

	return errors;
}

/**
 * Validate TruckingFollowUp row for Đăng ký xuất tàu action
 * Rules:
 *  1. operationType must be XUAT (hàng xuất)
 *  2. All containers must have soDangKy (số đăng ký)
 */
export function validateForRegisterVesselDeparture(
	row: TruckingFollowUpRow,
): ValidationError[] {
	const errors: ValidationError[] = [];

	// 1. Must be XUAT (export)
	const operationType = row.operationType?.toUpperCase() || "";
	if (operationType !== "XUAT") {
		errors.push({
			field: "operationType",
			message: `Action này chỉ áp dụng cho hàng Xuất (XUAT)`,
		});
		return errors;
	}

	// 2. eportBooking required
	if (!row.eportBooking) {
		errors.push({
			field: "eportBooking",
			message: `${TRUCKING_FOLLOWUP_LABELS.eportBooking} là bắt buộc`,
		});
	}

	// 3. At least one container required
	if (!row.containers || row.containers.length === 0) {
		errors.push({
			field: "containers",
			message: "Cần ít nhất một container để đăng ký xuất tàu",
		});
	} else {
		// 4. Every container must have soDangKy
		row.containers.forEach((container, index) => {
			if (!(container as any).soDangKy) {
				errors.push({
					field: `containers[${index}].soDangKy`,
					message: `Container #${index + 1}: Số đăng ký là bắt buộc`,
				});
			}
		});
	}

	return errors;
}

/**
 * Validate TruckingFollowUp row based on the bot action
 * Routes to appropriate validation function
 */
export function validateTruckingFollowUpForBotAction(
	row: TruckingFollowUpRow,
	action: TruckingBotActionType,
): ValidationError[] {
	switch (action) {
		case TRUCKING_BOT_ACTIONS.TRUCKING_INPUT:
			return validateForTruckingInput(row);

		case TRUCKING_BOT_ACTIONS.POD_MAKING:
			return validateForPODMaking(row);

		case TRUCKING_BOT_ACTIONS.EPORT_DECLARATION:
			return validateForEportDeclaration(row);

		case TRUCKING_BOT_ACTIONS.MAKING_CONTAINER_PACKING:
			return validateForMakingContainerPacking(row);

		case TRUCKING_BOT_ACTIONS.FAST_FINISH:
			return []; // No validation needed for FAST Finish

		case TRUCKING_BOT_ACTIONS.REGISTER_VESSEL_DEPARTURE:
			return validateForRegisterVesselDeparture(row);

		case TRUCKING_BOT_ACTIONS.FAST_UNFINISH:
			return []; // No validation needed for FAST Un-Finish

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
