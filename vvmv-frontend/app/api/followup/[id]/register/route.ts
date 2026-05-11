import { type NextRequest, NextResponse } from "next/server";
import type {
	CargoListRow,
	DeclarationRow,
	FollowUpCdsInfoRow,
} from "@/app/(home)/internal/followup/types";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { sanitizeCargoListPayload } from "@/lib/followup/ai-ocr-sync";
import {
	applyCdsCompanyPartyDefaults,
	buildCdsCompanyPartyDefaultsFromPartnerMaster,
	buildCdsCompanyPartyDefaultWarnings,
	mergeCdsCompanyPartyDefaults,
} from "@/lib/followup/cds-company-party-defaults";
import {
	assertCdsReadyForEcusExport,
	CdsExportValidationError,
	formatCdsExportValidationIssues,
	getBlockingCdsExportIssues,
} from "@/lib/followup/cds-export-validation";
import {
	type CdsPayload,
	sanitizeCdsInfoPayload,
} from "@/lib/followup/cds-info-sanitize";
import {
	buildCdsCollectionWrites,
	CDS_INFO_COLLECTION_INCLUDE,
	toPrismaCdsScalarPayload,
} from "@/lib/followup/cds-normalized-collections";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import {
	getHanConnectionPublicInfo,
	hasHanConnectionConfigForTaxCode,
	resolveHanConnectionForTaxCode,
} from "@/lib/followup/han-connection";
import { loadHanCompanyPartyProfileByTaxCode } from "@/lib/followup/han-declaration-loader";
import { registerCdsIntoHan } from "@/lib/followup/han-declaration-writer";
import { buildMergedPartnerMasterCdsDefaults } from "@/lib/followup/partners-master-cds-defaults";
import type { Prisma } from "@/prisma/client";

export const runtime = "nodejs";

function extractErrorCode(error: unknown): string | null {
	if (!error || typeof error !== "object") {
		return null;
	}

	const record = error as {
		code?: unknown;
		originalError?: { code?: unknown } | null;
	};
	if (typeof record.code === "string" && record.code.trim() !== "") {
		return record.code.trim().toUpperCase();
	}

	if (
		record.originalError &&
		typeof record.originalError.code === "string" &&
		record.originalError.code.trim() !== ""
	) {
		return record.originalError.code.trim().toUpperCase();
	}

	return null;
}

function toErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error ?? "");
}

function mapHanRegisterErrorMessage(error: unknown) {
	const code = extractErrorCode(error);
	const message = toErrorMessage(error);
	const normalizedMessage = message.toLowerCase();

	if (code === "ELOGIN" || normalizedMessage.includes("login failed")) {
		return "Kết nối data người dùng thất bại: sai tài khoản SQL hoặc chưa được cấp quyền database.";
	}

	if (
		code === "ETIMEOUT" ||
		code === "ESOCKET" ||
		normalizedMessage.includes("failed to connect") ||
		normalizedMessage.includes("timed out")
	) {
		return "Kết nối data người dùng thất bại: không truy cập được SQL Server (mạng/cổng/VPN).";
	}

	if (
		normalizedMessage.includes("ssl") ||
		normalizedMessage.includes("tls") ||
		normalizedMessage.includes("unsupported protocol")
	) {
		return "Kết nối data người dùng thất bại: lỗi mã hóa TLS giữa app và SQL Server.";
	}

	return message || "Internal Server Error";
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth.api.getSession({ headers: req.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
		);

		if (!permission.ok) {
			// Registering CDS is an action frequently handled by same-site operations
			// users who can view/work the follow-up but are not the original owner.
			// Keep explicit write denials (e.g. Accounting) intact, but allow these
			// users when they satisfy read access.
			if (permission.status === 403 && permission.error === "Access denied") {
				const readPermission = await checkFollowUpPermission(
					id,
					session.user.id,
					session.user.role ?? "",
					{ mode: "read" },
				);

				if (!readPermission.ok) {
					return NextResponse.json(
						{ error: permission.error },
						{ status: permission.status },
					);
				}
			} else {
				return NextResponse.json(
					{ error: permission.error },
					{ status: permission.status },
				);
			}
		}

		const body = await req.json().catch(() => ({}));
		const declarationId =
			typeof body?.declarationId === "number" &&
			Number.isFinite(body.declarationId)
				? body.declarationId
				: null;

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			include: {
				cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
				cargoLists: true,
				containers: {
					orderBy: {
						createdAt: "asc",
					},
					select: {
						id: true,
						containerNo: true,
					},
				},
				declarations: {
					orderBy: [{ declarationDate: "desc" }, { createdAt: "desc" }],
				},
			},
		});

		if (!followUp) {
			return NextResponse.json(
				{ error: "Follow-up not found" },
				{ status: 404 },
			);
		}

		if (!followUp.cdsInfo) {
			return NextResponse.json(
				{ error: "Chưa có CDS info để ghi sang HAN_2024." },
				{ status: 400 },
			);
		}

		const cdsInfo = followUp.cdsInfo as unknown as Partial<FollowUpCdsInfoRow>;
		const cargoList = followUp.cargoLists as unknown as Array<
			Partial<CargoListRow>
		>;
		const declarations = followUp.declarations as unknown as DeclarationRow[];
		const companyPartyTaxCode =
			String(cdsInfo.importerCode ?? followUp.taxCode ?? "").replace(
				/\D+/g,
				"",
			) || null;
		const hasHanConnectionConfig = await hasHanConnectionConfigForTaxCode({
			taxCode: companyPartyTaxCode,
			taxCodeCandidates: [cdsInfo.importerCode, followUp.taxCode],
			site: followUp.domain,
		});
		if (!hasHanConnectionConfig) {
			return NextResponse.json(
				{
					error:
						"Thiếu cấu hình data người dùng (dd_info) và chưa có HAN env override cho MST hiện tại.",
				},
				{ status: 422 },
			);
		}
		const hanConnection = await resolveHanConnectionForTaxCode({
			taxCode: companyPartyTaxCode,
			taxCodeCandidates: [cdsInfo.importerCode, followUp.taxCode],
			site: followUp.domain,
		});
		const hanConnectionInfo = getHanConnectionPublicInfo(hanConnection);
		const partnerCandidates = companyPartyTaxCode
			? await prismaRPA.partnersMasterData.findMany({
					take: 50,
					orderBy: [{ updatedAt: "desc" }],
					where: { taxCode: companyPartyTaxCode },
					select: {
						taxCode: true,
						fullName: true,
						invoiceData: true,
						invoiceCompanyName: true,
						invoiceAddress: true,
						invoicePostalCode: true,
						invoicePhone: true,
						maHQ: true,
						warehouse: true,
						site: true,
						enableCDS: true,
					},
				})
			: [];
		const partnerMasterCompanyPartyDefaults =
			buildCdsCompanyPartyDefaultsFromPartnerMaster(
				buildMergedPartnerMasterCdsDefaults({
					followUp: {
						operationType: followUp.operationType,
						taxCode: companyPartyTaxCode ?? followUp.taxCode,
						companyName: followUp.companyName,
					},
					partners: partnerCandidates,
					preferredSite: followUp.domain,
				}),
			);
		const hanAppCompanyPartyDefaults = companyPartyTaxCode
			? await loadHanCompanyPartyProfileByTaxCode({
					connectionString: hanConnection.connectionString,
					taxCode: companyPartyTaxCode,
				})
					.then((profile) =>
						profile
							? {
									importerCode: profile.taxCode,
									importExportUnitName: profile.companyName,
									importerPostalCode: profile.importerPostalCode,
									importExportBusinessAddress:
										profile.importExportBusinessAddress,
									importerPhone: profile.importerPhone,
								}
							: {},
					)
					.catch((error) => {
						console.warn(
							"Unable to resolve company party defaults from HAN_2024:",
							error instanceof Error ? error.message : error,
						);
						return {};
					})
			: {};
		const companyPartyDefaults = mergeCdsCompanyPartyDefaults(
			partnerMasterCompanyPartyDefaults,
			hanAppCompanyPartyDefaults,
		);
		const companyPartyWarnings = buildCdsCompanyPartyDefaultWarnings(
			cdsInfo,
			companyPartyDefaults,
		).map((warning) => warning.message);
		const cdsInfoForRegister = applyCdsCompanyPartyDefaults(
			cdsInfo,
			companyPartyDefaults,
		);
		const validation = assertCdsReadyForEcusExport({
			cdsInfo: cdsInfoForRegister,
			cargoList,
			declarations,
			followUpSummary: {
				operationType: followUp.operationType,
				companyName: followUp.companyName,
				supplier: followUp.supplier,
				billOrBooking: followUp.billOrBooking,
				quantity: followUp.quantity,
				unit: followUp.unit,
				grossWeight: followUp.grossWeight,
				invoice: followUp.invoice,
				location: followUp.location,
				loadingLocation: followUp.loadingLocation,
				pickupLocation: followUp.pickupLocation,
				transportMethod: followUp.transportMethod,
				notes: followUp.notes,
			},
			operationType: followUp.operationType,
		});

		const latestLocalDeclaration = followUp.declarations[0] ?? null;
		const registerResult = await registerCdsIntoHan({
			connectionString: hanConnection.connectionString,
			cdsInfo: cdsInfoForRegister,
			cargoList,
			containers: followUp.containers,
			declarationId,
			followUpTaxCode: companyPartyTaxCode ?? followUp.taxCode,
			followUpCompanyName: followUp.companyName,
			followUpSummary: {
				operationType: followUp.operationType,
				taxCode: companyPartyTaxCode ?? followUp.taxCode,
				companyName: followUp.companyName,
				supplier: followUp.supplier,
				billOrBooking: followUp.billOrBooking,
				quantity: followUp.quantity,
				unit: followUp.unit,
				grossWeight: followUp.grossWeight,
				invoice: followUp.invoice,
				warehouse: followUp.warehouse,
			},
			declarations,
			operationType: followUp.operationType,
			localDeclarationId: latestLocalDeclaration?.id ?? null,
			warnings: [
				...companyPartyWarnings,
				...validation.issues
					.filter((issue) => issue.severity === "warning")
					.map((issue) => issue.message),
			],
		});

		const registeredAt = new Date();
		const roundTripPersistedData = registerResult.roundTripDeclaration?.prefill
			? (sanitizeCdsInfoPayload(
					registerResult.roundTripDeclaration.prefill as CdsPayload,
				) as Prisma.FollowUpCdsInfoUncheckedUpdateInput)
			: {};

		await prismaRPA.followUpCdsInfo.update({
			where: { followUpId: id },
			data: {
				...roundTripPersistedData,
				cdsStatus: "REGISTERED",
				ecusDeclarationId: registerResult.declarationId,
				registeredAt,
				registeredBy: session.user.id,
			},
		});

		logFollowUpActivity(id, {
			userId: session.user.id,
			userName: session.user.name,
			action: "REGISTER_CDS_HAN",
			subResource: "cds_info",
			newValue: {
				declarationId: registerResult.declarationId,
				declarationNumber: registerResult.declarationNumber,
				status: registerResult.status,
				insertedTables: registerResult.insertedTables,
				updatedTables: registerResult.updatedTables,
				hanConnection: hanConnectionInfo,
				warnings: registerResult.warnings,
				verify: registerResult.verify,
			},
		});

		return NextResponse.json({
			success: true,
			data: {
				...registerResult,
				roundTripDeclaration: registerResult.roundTripDeclaration
					? {
							...registerResult.roundTripDeclaration,
							cargoList: sanitizeCargoListPayload(
								registerResult.roundTripDeclaration.cargoList,
							),
						}
					: null,
				lifecycleStatus: "REGISTERED",
				registeredAt: registeredAt.toISOString(),
				registeredBy: session.user.id,
				hanConnection: hanConnectionInfo,
			},
		});
	} catch (error) {
		console.error("Error registering CDS into HAN_2024:", error);

		if (error instanceof CdsExportValidationError) {
			const blockingIssues = getBlockingCdsExportIssues(error.issues);
			return NextResponse.json(
				{
					error: formatCdsExportValidationIssues(
						blockingIssues.length > 0 ? blockingIssues : error.issues,
						{ maxItems: 4 },
					),
					issues: error.issues,
				},
				{ status: 422 },
			);
		}

		return NextResponse.json(
			{
				error: mapHanRegisterErrorMessage(error),
			},
			{ status: 500 },
		);
	}
}
