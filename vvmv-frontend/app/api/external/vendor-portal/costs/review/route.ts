import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { queryERPHAN } from "@/lib/db/erp-han";
import { queryERPHCM } from "@/lib/db/erp-hcm";

type ReviewBody = {
	costId: string;
	action: "APPROVE" | "REJECT";
	reason?: string;
};

/**
 * Lookup PartnerID in ERP by vendor name (created_by_vendor).
 * Chọn ERP HCM (SGN) hoặc ERP HAN (HAN/DAD) theo domain của job.
 */
async function getErpPartnerId(
	partnerName: string,
	domain: string | null,
): Promise<string | null> {
	const query =
		"SELECT TOP 1 PartnerID FROM Partners WHERE PartnerName = @partnerName and Denied = 0";
	const params = { partnerName };
	try {
		const isHan = domain === "HAN" || domain === "DAD";
		const result = isHan
			? await queryERPHAN<{ PartnerID: string }>(query, params)
			: await queryERPHCM<{ PartnerID: string }>(query, params);
		return result.recordset?.[0]?.PartnerID ?? null;
	} catch (err) {
		console.error("[review] ERP PartnerID lookup failed:", err);
		return null;
	}
}

/**
 * Lookup PartnerID in ERP by TaxCode (invoiceTaxCode of TruckingFollowUp).
 */
async function getErpObjPartnerId(
	taxcode: string,
	domain: string | null,
): Promise<string | null> {
	const query =
		"SELECT TOP 1 PartnerID FROM Partners WHERE Taxcode = @taxcode and Denied = 0";
	const params = { taxcode };
	try {
		const isHan = domain === "HAN" || domain === "DAD";
		const result = isHan
			? await queryERPHAN<{ PartnerID: string }>(query, params)
			: await queryERPHCM<{ PartnerID: string }>(query, params);
		return result.recordset?.[0]?.PartnerID ?? null;
	} catch (err) {
		console.error("[review] ERP ObjPartnerID lookup failed:", err);
		return null;
	}
}

/**
 * Lookup vatType and creditOnlyFeeCodes from partners_master_data by taxCode.
 */
async function getPartnerConfig(taxCode: string | null): Promise<{
	vatType: string | null;
	creditOnlyFeeCodes: string[];
}> {
	if (!taxCode) return { vatType: null, creditOnlyFeeCodes: [] };
	try {
		const partner = await prismaRPA.partnersMasterData.findFirst({
			where: { taxCode },
			select: { vatType: true, creditOnlyFeeCodes: true },
		});
		return {
			vatType: partner?.vatType ?? null,
			creditOnlyFeeCodes: partner?.creditOnlyFeeCodes ?? [],
		};
	} catch (err) {
		console.error("[review] partner config lookup failed:", err);
		return { vatType: null, creditOnlyFeeCodes: [] };
	}
}

/**
 * Determine if a cost is "HĐ viết về VVMV" based on vatPercent (8% or 5%).
 */
function isVVMVInvoice(vatPercent: number | null): boolean {
	return vatPercent === 8 || vatPercent === 5;
}

/**
 * Push a single VendorCost (chi hộ / isDisbursement=true) to FastPro ERP.
 *
 * 3 cases:
 * 1. HĐ viết về KH (vatPercent != 8 và != 5):
 *    → 1 fee OTHERCREDIT, obhPartnerID = objPartnerId (MST khách hàng)
 *
 * 2. HĐ viết về VVMV, KHÔNG có vatType trong partners_master_data:
 *    → 1 fee OTHERCREDIT, obhPartnerID = ""
 *
 * 3. HĐ viết về VVMV, CÓ vatType trong partners_master_data:
 *    → 2 fees: OTHERCREDIT (giá gốc) + OTHERDEBIT (tính theo 4 sub-case vatType)
 *
 * OTHERDEBIT sub-cases:
 *   SAU VAT CÓ VAT     → unitPrice = totalFee, vat = 8, total = round(totalFee * 1.08)
 *   TRƯỚC VAT CÓ VAT   → unitPrice = totalFee - totalVat, vat = 8, total = totalFee
 *   TRƯỚC VAT KHÔNG VAT→ unitPrice = totalFee - totalVat, vat = 0, total = totalFee - totalVat
 *   SAU VAT KHÔNG VAT  → unitPrice = totalFee, vat = 0, total = totalFee
 */
async function importFeeToERP(
	cost: {
		feeName: string;
		vatPercent: number | null;
		totalVat: number | null;
		totalFee: number | null;
		invoiceNumber: string | null;
		createdByVendor: string | null;
		sellerTaxCode: string | null;
		feeType?: {
			feeDescription: string | null;
			isNotDefault: boolean;
		} | null;
		isSelling: boolean;
	},
	jobNumber: string,
	fcrNumber: string,
	partnerId: string, // Standard case/fallback partnerId
	objPartnerId: string | null,
	vatType: string | null,
	domain: string | null, // Added domain for dynamic lookup
	creditOnlyFeeCodes: string[], // Fee codes that skip OTHERDEBIT in Case 3
) {
	const apiKey = process.env.FASTPRO_API_KEY;
	if (!apiKey) throw new Error("FASTPRO_API_KEY is not configured");

	const totalFee = cost.totalFee ?? 0;
	const totalVat = cost.totalVat ?? 0;
	const vatPercent = cost.vatPercent ?? 0;
	const unitPrice = totalFee - totalVat; // giá trước VAT
	let arPartnerId;
	const feeCode = cost.feeName;
	const docs = cost.invoiceNumber ?? "";
	const vvmv = isVVMVInvoice(cost.vatPercent);

	const feeDescription = cost.feeType?.feeDescription || cost.feeName;
	const invoiceSuffix = cost.invoiceNumber ? ` (${cost.invoiceNumber})` : "";
	const description = `${feeDescription} ${invoiceSuffix}`;

	let fees: any[];
	let caseNumber = 0;

	if (cost.feeType?.isNotDefault) {
		if (cost.isSelling) {
			// ── Case 10: Selling for Non-Default Fees ───────────────────────────────
			caseNumber = 10;
			const baseAmount = totalFee;
			const finalTotal = Math.round(baseAmount * 1.08);

			fees = [
				{
					job: jobNumber,
					hbl: fcrNumber,
					quantity: "1",
					unit: "shipment",
					unitPrice: String(baseAmount),
					currency: "VND",
					extRate: "1",
					vat: "8",
					total: String(finalTotal),
					docs,
					feeCode: feeCode ? feeCode.replace(/^B_/, "S_") : feeCode,
					PartnerId: objPartnerId,
					obhPartnerID: "",
					type: "OTHERDEBIT",
					description: `${description}`,
				},
			];
		} else {
			// ── Case 0: Buying for Non-Default Fees ──────────────────────────────────
			// Add as OTHERCREDIT, base = totalFee, vat = 8%, total = base * 1.08
			caseNumber = 0;
			arPartnerId = partnerId;
			const baseAmount = totalFee;
			const finalTotal = Math.round(baseAmount * 1.08);

			fees = [
				{
					job: jobNumber,
					hbl: fcrNumber,
					quantity: "1",
					unit: "shipment",
					unitPrice: String(baseAmount),
					currency: "VND",
					extRate: "1",
					vat: "8",
					total: String(finalTotal),
					docs,
					feeCode,
					PartnerId: partnerId,
					obhPartnerID: "",
					type: "OTHERCREDIT",
					description: `${description}`,
				},
			];
		}
	} else if (!vvmv) {
		// ── Case 1: HĐ viết về KH ──────────────────────────────────────────────────
		caseNumber = 1;
		arPartnerId = partnerId;
		fees = [
			{
				job: jobNumber,
				hbl: fcrNumber,
				quantity: "1",
				unit: "shipment",
				unitPrice: String(unitPrice),
				currency: "VND",
				extRate: "1",
				vat: String(vatPercent),
				total: String(totalFee),
				docs,
				feeCode,
				PartnerId: partnerId,
				obhPartnerID: objPartnerId ?? "",
				type: "OTHERCREDIT",
				description,
			},
		];
	} else if (!vatType) {
		// ── Case 2: HĐ viết về VVMV, KHÔNG có vatType ──────────────────────────────
		caseNumber = 2;
		let creditPartnerId = partnerId;
		if (cost.sellerTaxCode) {
			const cleanTaxCode = cost.sellerTaxCode.replace(/['\s]/g, "");
			const foundId = await getErpObjPartnerId(cleanTaxCode, domain);
			if (foundId) {
				creditPartnerId = foundId;
			} else {
				throw new Error(
					`Không tìm thấy PartnerID trong ERP cho Seller Tax Code: "${cost.sellerTaxCode}"`,
				);
			}
		} else {
			throw new Error(
				`Phí có vatType nhưng thiếu Seller Tax Code. Không thể xác định PartnerID cho VVMV.`,
			);
		}
		arPartnerId = creditPartnerId;
		fees = [
			{
				job: jobNumber,
				hbl: fcrNumber,
				quantity: "1",
				unit: "shipment",
				unitPrice: String(unitPrice),
				currency: "VND",
				extRate: "1",
				vat: String(vatPercent),
				total: String(totalFee),
				docs,
				feeCode,
				PartnerId: creditPartnerId,
				obhPartnerID: "",
				type: "OTHERCREDIT",
				description,
			},
		];
	} else {
		// ── Case 3: HĐ viết về VVMV, CÓ vatType ────────────────────────────────────
		caseNumber = 3;
		// Case 3 Requirement: OTHERCREDIT PartnerId lookup via sellerTaxCode

		let creditPartnerId = partnerId;
		if (cost.sellerTaxCode) {
			const cleanTaxCode = cost.sellerTaxCode.replace(/['\s]/g, "");
			const foundId = await getErpObjPartnerId(cleanTaxCode, domain);
			if (foundId) {
				creditPartnerId = foundId;
			} else {
				throw new Error(
					`Không tìm thấy PartnerID trong ERP cho Seller Tax Code: "${cost.sellerTaxCode}"`,
				);
			}
		} else {
			throw new Error(
				`Phí có vatType nhưng thiếu Seller Tax Code. Không thể xác định PartnerID cho VVMV.`,
			);
		}
		arPartnerId = creditPartnerId;
		const creditFee = {
			job: jobNumber,
			hbl: fcrNumber,
			quantity: "1",
			unit: "shipment",
			unitPrice: String(unitPrice),
			currency: "VND",
			extRate: "1",
			vat: String(vatPercent),
			total: String(totalFee),
			docs,
			feeCode,
			PartnerId: creditPartnerId,
			obhPartnerID: "",
			type: "OTHERCREDIT",
			description,
		};

		// ── Case 3 credit-only shortcut ──────────────────────────────────────────
		// Nếu fee_code nằm trong danh sách creditOnlyFeeCodes của partner (lookup
		// bằng sellerTaxCode) → chỉ push 1 fee OTHERCREDIT, bỏ qua OTHERDEBIT.
		if (creditOnlyFeeCodes.includes(feeCode)) {
			fees = [creditFee];
		} else {
			// OTHERDEBIT: tính theo 4 sub-case của vatType
			let debitUnitPrice: number;
			let debitVat: number;
			let debitTotal: number;
			switch (vatType) {
				case "SAU VAT CÓ VAT":
					// Giá đã bao gồm VAT → unitPrice = totalFee, tính thêm 8%
					debitUnitPrice = totalFee;
					debitVat = 8;
					debitTotal = Math.round(totalFee * 1.08);
					break;

				case "TRƯỚC VAT CÓ VAT":
					// Giá chưa bao gồm VAT, có tính VAT 8%
					debitUnitPrice = totalFee - totalVat;
					debitVat = 8;
					debitTotal = totalFee;
					break;

				case "TRƯỚC VAT KHÔNG VAT":
					// Giá chưa bao gồm VAT, không tính VAT
					debitUnitPrice = totalFee - totalVat;
					debitVat = 0;
					debitTotal = totalFee - totalVat;
					break;

				case "SAU VAT KHÔNG VAT":
					// Giá đã bao gồm VAT, không tính thêm VAT
					debitUnitPrice = totalFee;
					debitVat = 0;
					debitTotal = totalFee;
					break;

				default:
					// Fallback: giống creditFee
					debitUnitPrice = unitPrice;
					debitVat = vatPercent;
					debitTotal = totalFee;
					break;
			}

			const debitFee = {
				job: jobNumber,
				hbl: fcrNumber,
				quantity: "1",
				unit: "shipment",
				unitPrice: String(debitUnitPrice),
				currency: "VND",
				extRate: "1",
				vat: String(debitVat),
				total: String(debitTotal),
				docs: "",
				feeCode: feeCode ? feeCode.replace(/^B_/, "S_") : feeCode,
				PartnerId: objPartnerId,
				obhPartnerID: "",
				type: "OTHERDEBIT",
				description,
			};

			fees = [creditFee, debitFee];
		}
	}

	const payload = { fees, username: "API" };
	// console.log("payload", payload);
	const response = await fetch(
		"https://fastpro-api.softek.com.vn/api/v1/fees/check-and-import",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify(payload),
		},
	);

	const data = await response.json();
	return {
		ok: response.ok,
		status: response.status,
		data,
		arPartnerId,
		payload,
		caseNumber,
	};
}

export async function PATCH(request: NextRequest) {
	try {
		// Internal user auth (not vendor portal auth)
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body: ReviewBody = await request.json();
		const { costId, action, reason } = body;
		let reviewMessage: string | null = null;

		if (!costId || !action) {
			return NextResponse.json(
				{ message: "costId and action are required" },
				{ status: 400 },
			);
		}

		if (action !== "APPROVE" && action !== "REJECT") {
			return NextResponse.json(
				{ message: "action must be APPROVE or REJECT" },
				{ status: 400 },
			);
		}

		if (action === "REJECT" && !reason?.trim()) {
			return NextResponse.json(
				{ message: "Phải nhập lý do từ chối" },
				{ status: 400 },
			);
		}

		// Fetch full cost record with related FCR and TruckingFollowUp
		const cost = await prismaRPA.vendorCost.findUnique({
			where: { id: costId },
			select: {
				id: true,
				truckingFollowUpId: true,
				fcrId: true,
				vendorId: true,
				feeTypeId: true,
				status: true,
				isDisbursement: true,
				feeName: true,
				vatPercent: true,
				totalVat: true,
				totalFee: true,
				invoiceNumber: true,
				createdByVendor: true,
				sellerTaxCode: true,
				isSelling: true,

				fcr: {
					select: {
						fcrNumber: true,
						truckingFollowUp: {
							select: {
								jobNumber: true,
								domain: true,
								taxCode: true,
								invoiceTaxCode: true,
							},
						},
					},
				},
				feeType: {
					select: {
						feeDescription: true,
						isNotDefault: true,
					},
				},
			},
		});

		if (!cost) {
			return NextResponse.json(
				{ message: "Không tìm thấy phí" },
				{ status: 404 },
			);
		}

		if (cost.status === "APPROVED" && action === "APPROVE") {
			return NextResponse.json(
				{ message: "Phí này đã được duyệt rồi" },
				{ status: 409 },
			);
		}

		// ── APPROVE with ERP import (only for chi hộ / isDisbursement=true) ──
		let erpResult: any = null;
		const isSpecialFee = cost.feeType?.isNotDefault === true;

		// ── APPROVE logic for Disbursement OR Special Non-Default Fees ──
		if (action === "APPROVE" && (cost.isDisbursement || isSpecialFee)) {
			const jobNumber = cost.fcr?.truckingFollowUp?.jobNumber;
			const fcrNumber = cost.fcr?.fcrNumber;
			const vendorName = cost.createdByVendor;
			const domain = cost.fcr?.truckingFollowUp?.domain ?? null;
			// invoiceTaxCode dùng tra ObjPartnerID (cho case HĐ KH)
			const invoiceTaxCode = cost.fcr?.truckingFollowUp?.taxCode ?? null;
			// taxCode dùng tra vatType trong partners_master_data (cho case HĐ VVMV)
			const clientTaxCode = cost.fcr?.truckingFollowUp?.taxCode ?? null;

			if (!jobNumber || !fcrNumber) {
				return NextResponse.json(
					{
						message:
							"Không thể import vào ERP: thiếu Job Number hoặc FCR Number",
					},
					{ status: 422 },
				);
			}

			// Lookup PartnerID từ ERP theo tên vendor
			let partnerId: string | null = null;
			if (vendorName) {
				partnerId = await getErpPartnerId(vendorName, domain);
			}

			if (!partnerId) {
				return NextResponse.json(
					{
						message: `Không tìm thấy PartnerID trong ERP cho vendor: "${vendorName ?? "N/A"}". Vui lòng kiểm tra lại tên vendor.`,
					},
					{ status: 422 },
				);
			}

			// Lookup ObjPartnerID từ ERP theo MST khách hàng (chỉ dùng cho HĐ KH)
			let objPartnerId: string | null = null;
			if (invoiceTaxCode) {
				objPartnerId = await getErpObjPartnerId(invoiceTaxCode, domain);
			}

			// Lookup vatType từ partners_master_data (chỉ dùng cho HĐ VVMV)
			const partnerConfig = isVVMVInvoice(cost.vatPercent)
				? await getPartnerConfig(clientTaxCode)
				: { vatType: null, creditOnlyFeeCodes: [] as string[] };
			const vatType = partnerConfig.vatType;
			const creditOnlyFeeCodes = partnerConfig.creditOnlyFeeCodes;

			// Gọi FastPro ERP import API theo đúng case
			erpResult = await importFeeToERP(
				cost,
				jobNumber,
				fcrNumber,
				partnerId,
				objPartnerId,
				vatType,
				domain,
				creditOnlyFeeCodes,
			);

			// Create log record
			const erpLog = await prismaRPA.vendorCostErpLog.create({
				data: {
					vendorCostId: costId,
					caseNumber: erpResult.caseNumber,
					erpPayload: erpResult.payload,
				},
			});
			const _erpLogId = erpLog.id;

			if (!erpResult.ok || erpResult.data?.success === false) {
				const erpMsg =
					erpResult.data?.message ??
					erpResult.data?.data?.message ??
					"ERP import thất bại";
				const erpErrors: string[] = erpResult.data?.data?.errors ?? [];

				await prismaRPA.vendorCost.update({
					where: { id: costId },
					data: { reviewMessage: `Lỗi import ERP: ${erpMsg}` },
				});

				return NextResponse.json(
					{
						message: `Import vào ERP thất bại: ${erpMsg}`,
						erpErrors,
						erpData: erpResult.data,
					},
					{ status: 422 },
				);
			}

			// If ERP import succeeded, call the API to create AR for the OTHERCREDIT fee
			// ONLY if this is a Special (Non-Default) fee AND it is a Buying row (not isSelling)
			const _feeCode = cost.feeName;
			const _totalFee = cost.totalFee ?? 0;
			const _docs = cost.invoiceNumber ?? "";
			const _arPartnerId = erpResult.arPartnerId;

			/*
      if (isSpecialFee && !cost.isSelling) {
        try {
          const finalTotalWithVat = Math.round(totalFee * 1.08);
          const baseUrl = request.nextUrl.origin;
          const arRes = await fetch(`${baseUrl}/api/external/erp/create-ar`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              domain,
              hbl: fcrNumber,
              job: jobNumber,
              docs,
              total: finalTotalWithVat,
              feeCode,
              partnerId: arPartnerId,
            }),
          });

          const arRequestBody = {
            domain,
            hbl: fcrNumber,
            job: jobNumber,
            docs,
            total: finalTotalWithVat,
            feeCode,
            partnerId: arPartnerId,
          };

        // Update log with AR body
        await prismaRPA.vendorCostErpLog.update({
          where: { id: erpLogId },
          data: { arPayload: arRequestBody },
        });

        const arData = await arRes.json();
        if (!arRes.ok) {
          console.error("[review] Auto AR creation failed:", arData);
          const errMsg = `Đã import ERP nhưng tạo AR thất bại: ${arData.message || arData.details || "Unknown error"}`;
          await prismaRPA.vendorCost.update({
            where: { id: costId },
            data: { reviewMessage: errMsg },
          });
          return NextResponse.json(
            {
              message: errMsg,
              erpData: erpResult.data,
            },
            { status: 422 },
          );
        } else {
          if (!erpResult.data) erpResult.data = {};
          erpResult.data.arMessage = `Đã tự động tạo Advance Request: ${arData.arNo}`;
          erpResult.data.arNo = arData.arNo;

          // Save AR to PaymentRequest
          await prismaRPA.paymentRequest.create({
            data: {
              arNumber: arData.arNo,
              type: isSpecialFee ? "PHI_NGOAI_DEFAULT" : "CHIHO",
              amount: finalTotalWithVat,
              taxCode: clientTaxCode,
              truckingFollowUpId: cost.truckingFollowUpId,
              domain: domain as any,
              createdBy: session.user.id,
            },
          });
          reviewMessage = `Duyệt & Import ERP thành công (AR: ${arData.arNo})`;

          // Create Selling Row for Accounting if this was a Buying row of a Non-Default fee
          if (isSpecialFee && !cost.isSelling) {
            await prismaRPA.vendorCost.create({
              data: {
                truckingFollowUpId: cost.truckingFollowUpId,
                fcrId: cost.fcrId,
                vendorId: cost.vendorId,
                feeTypeId: cost.feeTypeId,
                feeName: cost.feeName,
                isDisbursement: true,
                isSelling: true,
                status: "PENDING",
                totalFee: 0,
                note: "Doanh thu phí phát sinh (Vui lòng điền giá bán)",
                rowOrder: 99,
              },
            });
            reviewMessage += " & Đã tạo dòng doanh thu cho kế toán.";
          }
        }
      } catch (err: any) {
        console.error("[review] Auto AR exception:", err);
        if (!erpResult.data) erpResult.data = {};
        erpResult.data.arMessage = `Lỗi hệ thống khi gọi API tạo AR: ${err.message}`;
          reviewMessage = `Lỗi hệ thống khi tạo AR: ${err.message}`;
        }
      } else {
        reviewMessage = "Duyệt & Import ERP thành công";
      }
      */
			reviewMessage = "Duyệt & Import ERP thành công";
		}

		if (erpResult?.ok && !reviewMessage) {
			reviewMessage = `Duyệt & Import ERP thành công${erpResult.data?.arNo ? ` (AR: ${erpResult.data.arNo})` : ""}`;
		}

		// ── APPROVE logic for standard Trucking Fees (non-disbursement, non-special) ──
		// Always query ERP DB directly for the latest fees applied to this FCR/HBL
		if (action === "APPROVE" && !cost.isDisbursement && !isSpecialFee) {
			const fcrNumber = cost.fcr?.fcrNumber;
			const domain = cost.fcr?.truckingFollowUp?.domain ?? null;

			if (!fcrNumber) {
				return NextResponse.json(
					{ message: "Không tìm thấy FCR Number để đối chiếu ERP" },
					{ status: 400 },
				);
			}

			try {
				// Query ERP DB by HAWBNO (corresponds to FCR Number) from two sources:
				// 1. ProfitShares (standard)
				// 2. BuyingRateWithHBL (specific view)
				const sql = `
          SELECT SortDes as feeCode, (UnitPrice * Quantity) as totalAmount
          FROM (
            SELECT SortDes, UnitPrice, Quantity FROM ProfitShares WHERE HAWBNO = @fcrNumber AND DPT = 0
            UNION ALL
            SELECT SortDes, UnitPrice, Quantity FROM BuyingRateWithHBL WHERE HAWBNO = @fcrNumber
          ) t
        `;
				const queryFn =
					domain === "HAN" || domain === "DAD" ? queryERPHAN : queryERPHCM;

				// Use a generic type for the result
				const erpDbResult = await queryFn<any>(sql, { fcrNumber });

				const buyingRates = erpDbResult.recordset || [];

				// Identify all ERP lines that match the target fee name and amount
				const matchingErpLines = buyingRates.filter(
					(r: any) =>
						r.feeCode === cost.feeName &&
						Math.abs((r.totalAmount ?? 0) - (cost.totalFee ?? 0)) < 1,
				);

				if (matchingErpLines.length === 0) {
					const erpFee = buyingRates.find(
						(r: any) => r.feeCode === cost.feeName,
					);
					const erpInfo = erpFee
						? ` (FASTPRO: ${(erpFee.totalAmount ?? 0).toLocaleString("vi-VN")} VND)`
						: " (Không tìm thấy phí này trong FASTPRO cho FCR này)";

					const errorMessage = `Phí không khớp: ${(cost.totalFee ?? 0).toLocaleString("vi-VN")} ${cost.feeName}${erpInfo}`;

					await prismaRPA.vendorCost.update({
						where: { id: costId },
						data: { reviewMessage: errorMessage },
					});

					return NextResponse.json(
						{
							message: `Phí không khớp với FASTPRO cho FCR ${fcrNumber}. Vendor nhập: ${(cost.totalFee ?? 0).toLocaleString("vi-VN")} ${cost.feeName}${erpInfo}`,
						},
						{ status: 422 },
					);
				}

				// Check if we have already approved as many lines as there are in ERP
				// Count already approved costs in our DB for this FCR with same feeName and amount
				const alreadyApprovedCount = await prismaRPA.vendorCost.count({
					where: {
						fcrId: cost.fcrId ?? "",
						feeName: cost.feeName,
						totalFee: cost.totalFee, // We assume exact match for "duplicates"
						status: "APPROVED",
						id: { not: costId }, // Exclude current one just in case
					},
				});

				if (alreadyApprovedCount >= matchingErpLines.length) {
					const errMsg = `Phí ${cost.feeName} (${(cost.totalFee ?? 0).toLocaleString("vi-VN")} VND) đã được duyệt đủ số lượng dòng theo ERP (${matchingErpLines.length} dòng). Không thể duyệt thêm dòng trùng lặp.`;

					await prismaRPA.vendorCost.update({
						where: { id: costId },
						data: { reviewMessage: "Đã duyệt đủ số lượng dòng trong ERP" },
					});

					return NextResponse.json({ message: errMsg }, { status: 422 });
				}

				// If we reached here, there is at least one "available" ERP line and we can approve
				reviewMessage = `Khớp ERP: ${(cost.totalFee ?? 0).toLocaleString("vi-VN")} VND`;
			} catch (erpDbError) {
				console.error(
					"ERP DB query failed during trucking fee review:",
					erpDbError,
				);
				await prismaRPA.vendorCost.update({
					where: { id: costId },
					data: { reviewMessage: "Lỗi kết nối ERP khi đối chiếu" },
				});
				return NextResponse.json(
					{
						message:
							"Không thể kết nối ERP để đối chiếu phí. Vui lòng thử lại sau.",
					},
					{ status: 502 },
				);
			}
		}

		// Update status in our database
		await prismaRPA.vendorCost.update({
			where: { id: costId },
			data: {
				status: action === "APPROVE" ? "APPROVED" : "REJECTED",
				rejectionReason: action === "REJECT" ? reason?.trim() : null,
				reviewMessage: action === "APPROVE" ? reviewMessage : null,
				reviewedById: session.user.id,
				reviewedAt: new Date(),
			},
		});

		return NextResponse.json({
			success: true,
			reviewMessage,
			erpResult: erpResult?.data ?? null,
		});
	} catch (error: any) {
		console.error("Failed to review vendor cost:", error);
		return NextResponse.json(
			{ message: error?.message || "Failed to review vendor cost" },
			{ status: 500 },
		);
	}
}
