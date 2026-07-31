import { type NextRequest, NextResponse } from "next/server";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { logFollowUpActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { syncFollowUpDeclarationFromApp } from "@/lib/followup/app-declaration-sync";
import {
	buildFollowUpSyncPatchFromCdsInfo,
	type CdsFollowUpSyncField,
	normalizeTransportMethodCode,
} from "@/lib/followup/cds-followup-field-sync";
import {
	buildCdsHistoryDefaults,
	CDS_IMPORT_EXPORT_REFERENCE_FIELDS,
} from "@/lib/followup/cds-history-defaults";
import {
	CDS_INFO_JSON_FIELD_NAMES,
	type CdsPayload,
	sanitizeCdsInfoPayload,
} from "@/lib/followup/cds-info-sanitize";
import { CDS_DRAFT_LIFECYCLE_RESET } from "@/lib/followup/cds-lifecycle";
import {
	buildCdsCollectionWrites,
	CDS_INFO_COLLECTION_INCLUDE,
	hydrateCdsCollections,
	toPrismaCdsScalarPayload,
} from "@/lib/followup/cds-normalized-collections";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import {
	getHanConnectionPublicInfo,
	hasHanConnectionConfigForTaxCode,
	resolveHanConnectionForTaxCode,
} from "@/lib/followup/han-connection";
import {
	type HanCompanyPartyProfile,
	loadHanCompanyPartyProfileByTaxCode,
} from "@/lib/followup/han-declaration-loader";
import {
	buildMergedPartnerMasterCdsDefaults,
	type PartnerMasterCdsDefaults,
} from "@/lib/followup/partners-master-cds-defaults";
import type { Prisma } from "@/prisma/client";

export const runtime = "nodejs";
export const maxDuration = 120;

type PartnerSite = "SGN" | "HAN" | "DAD";

type FollowUpCompanySource = {
	operationType?: string | null;
	companyName: string | null;
	domain: PartnerSite | null;
	taxCode: string | null;
};

type ResolvedCompanyProfile = {
	taxCode: string;
	companyName: string;
	importerPostalCode: string | null;
	importExportBusinessAddress: string | null;
	importerPhone: string | null;
	exporterPostalCode: string | null;
	partnerAddress1: string | null;
	partnerAddress2: string | null;
	partnerAddress3: string | null;
	partnerAddress4: string | null;
	customsCode: string | null;
	warehouseLocationName: string | null;
};

type AppDeclarationSyncResult = {
	saved: Record<string, unknown>;
	cargoList: unknown[];
	declaration: {
		declarationNumber: string | null;
		declarationId: number;
	};
	sourceInfo: unknown;
};

const CDS_STEP_TIMEOUT_MS = Number.parseInt(
	process.env.CDS_STEP_TIMEOUT_MS || "8000",
	10,
);

function timeoutError(label: string, timeoutMs: number) {
	return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	let timer: NodeJS.Timeout | null = null;
	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(timeoutError(label, timeoutMs)),
				Math.max(timeoutMs, 1),
			);
		});
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}

function normalizeText(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function normalizeTaxCode(value: unknown) {
	const text = String(value ?? "").replace(/\D+/g, "");
	return text || null;
}

function resolvePartnerSite(
	followUpDomain: string | null | undefined,
	userSite: unknown,
): PartnerSite {
	const candidates = [followUpDomain, userSite];
	for (const candidate of candidates) {
		if (candidate === "SGN" || candidate === "HAN" || candidate === "DAD") {
			return candidate;
		}
	}

	return "SGN";
}

function buildCompanyProfileFromFollowUp(
	followUp: FollowUpCompanySource,
): ResolvedCompanyProfile | null {
	const taxCode = normalizeTaxCode(followUp.taxCode);
	const companyName = normalizeText(followUp.companyName);

	if (!taxCode && !companyName) {
		return null;
	}

	return {
		taxCode: taxCode ?? "",
		companyName: companyName ?? "",
		importerPostalCode: null,
		importExportBusinessAddress: null,
		importerPhone: null,
		exporterPostalCode: null,
		partnerAddress1: null,
		partnerAddress2: null,
		partnerAddress3: null,
		partnerAddress4: null,
		customsCode: null,
		warehouseLocationName: null,
	};
}

const HAN_APP_COMPANY_PROFILE_FALLBACK_FIELDS = [
	"importerPostalCode",
	"importExportBusinessAddress",
	"importerPhone",
	"customsCode",
	"warehouseLocationName",
] as const satisfies ReadonlyArray<keyof ResolvedCompanyProfile>;

function isPlaceholderPostalCode(value: unknown): boolean {
	return normalizeText(value)?.toLowerCase() === "x";
}

function shouldUseFallbackCompanyProfileValue(
	field: keyof ResolvedCompanyProfile,
	currentValue: unknown,
	fallbackValue: unknown,
) {
	if (!normalizeText(fallbackValue)) {
		return false;
	}

	if (!normalizeText(currentValue)) {
		return true;
	}

	return (
		field === "importerPostalCode" &&
		isPlaceholderPostalCode(currentValue) &&
		!isPlaceholderPostalCode(fallbackValue)
	);
}

function mergeCompanyProfileMissingValues(
	primary: ResolvedCompanyProfile | null,
	fallback: ResolvedCompanyProfile | null,
) {
	if (!primary) {
		return fallback;
	}

	if (!fallback) {
		return primary;
	}

	const next = { ...primary };

	HAN_APP_COMPANY_PROFILE_FALLBACK_FIELDS.forEach((field) => {
		if (
			shouldUseFallbackCompanyProfileValue(field, next[field], fallback[field])
		) {
			next[field] = fallback[field];
		}
	});

	return next;
}

function buildCompanyProfileFromPartnerMasterDefaults(
	followUp: FollowUpCompanySource,
	partnerDefaults: PartnerMasterCdsDefaults,
) {
	const baseProfile = buildCompanyProfileFromFollowUp({
		...followUp,
		taxCode: partnerDefaults.importerCode ?? followUp.taxCode,
		companyName: partnerDefaults.importExportUnitName ?? followUp.companyName,
	});

	if (!baseProfile) {
		return null;
	}

	return {
		...baseProfile,
		importerPostalCode:
			partnerDefaults.importerPostalCode ?? baseProfile.importerPostalCode,
		importExportBusinessAddress:
			partnerDefaults.importExportBusinessAddress ??
			baseProfile.importExportBusinessAddress,
		importerPhone: partnerDefaults.importerPhone ?? baseProfile.importerPhone,
		customsCode: partnerDefaults.customsCode ?? null,
		warehouseLocationName: partnerDefaults.warehouseLocationName ?? null,
	};
}

function buildCompanyProfileFromHanApp(
	followUp: FollowUpCompanySource,
	hanProfile: HanCompanyPartyProfile,
) {
	const baseProfile = buildCompanyProfileFromFollowUp({
		...followUp,
		taxCode: hanProfile.taxCode ?? followUp.taxCode,
		companyName: hanProfile.companyName ?? followUp.companyName,
	});

	if (!baseProfile) {
		return null;
	}

	return {
		...baseProfile,
		importerPostalCode:
			hanProfile.importerPostalCode ?? baseProfile.importerPostalCode,
		importExportBusinessAddress:
			hanProfile.importExportBusinessAddress ??
			baseProfile.importExportBusinessAddress,
		importerPhone: hanProfile.importerPhone ?? baseProfile.importerPhone,
	};
}

async function resolveHanAppCompanyProfileForFollowUp(args: {
	followUp: FollowUpCompanySource;
}) {
	const taxCode = normalizeTaxCode(args.followUp.taxCode);
	if (!taxCode) {
		return null;
	}

	const partnerConnection = await withTimeout(
		resolveHanConnectionForTaxCode({
			taxCode,
			site: args.followUp.domain,
		}),
		CDS_STEP_TIMEOUT_MS,
		"Resolve HAN connection for company profile",
	).catch(() => null);

	if (!partnerConnection?.connectionString) {
		return null;
	}

	try {
		const hanProfile = await withTimeout(
			loadHanCompanyPartyProfileByTaxCode({
				connectionString: partnerConnection.connectionString,
				taxCode,
			}),
			CDS_STEP_TIMEOUT_MS,
			"Load HAN company profile",
		);

		if (hanProfile) {
			return buildCompanyProfileFromHanApp(args.followUp, hanProfile);
		}
	} catch (error) {
		console.warn(
			"Unable to resolve CDS company profile from user data:",
			error instanceof Error ? error.message : error,
		);
	}

	return null;
}

async function resolvePartnerMasterDataForFollowUp(args: {
	followUp: FollowUpCompanySource;
	userSite: unknown;
}) {
	const taxCode = normalizeTaxCode(args.followUp.taxCode);
	const companyName = normalizeText(args.followUp.companyName);

	if (!taxCode) {
		return buildCompanyProfileFromFollowUp(args.followUp);
	}

	const site = resolvePartnerSite(args.followUp.domain, args.userSite);
	const hanAppProfilePromise = resolveHanAppCompanyProfileForFollowUp({
		followUp: args.followUp,
	});
	const partnerCandidates = await prismaRPA.partnersMasterData.findMany({
		take: 50,
		orderBy: [{ updatedAt: "desc" }],
		where: { taxCode },
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
	});

	let baseProfile: ResolvedCompanyProfile | null = null;

	if (partnerCandidates.length > 0) {
		const partnerDefaults = buildMergedPartnerMasterCdsDefaults({
			followUp: {
				...args.followUp,
				companyName,
			},
			partners: partnerCandidates,
			preferredSite: site,
		});

		baseProfile = buildCompanyProfileFromPartnerMasterDefaults(
			{
				...args.followUp,
				taxCode: partnerDefaults.importerCode ?? taxCode,
				companyName:
					partnerDefaults.importExportUnitName ?? companyName ?? null,
			},
			partnerDefaults,
		);
	} else {
		baseProfile = buildCompanyProfileFromFollowUp(args.followUp);
	}

	const hanAppProfile = await hanAppProfilePromise.catch((error) => {
		console.warn(
			"Unable to resolve CDS company profile fallback from user data:",
			error instanceof Error ? error.message : error,
		);
		return null;
	});

	return mergeCompanyProfileMissingValues(baseProfile, hanAppProfile);
}

function getCrossOperationReferenceConfig(
	operationType: string | null | undefined,
) {
	if (operationType === "NHAP") {
		return {
			referenceOperationType: "XUAT" as const,
			sourceLabel: "Tham chiếu từ hồ sơ xuất",
			fields: CDS_IMPORT_EXPORT_REFERENCE_FIELDS,
		};
	}

	if (operationType === "XUAT") {
		return {
			referenceOperationType: "NHAP" as const,
			sourceLabel: "Tham chiếu từ hồ sơ nhập",
			fields: CDS_IMPORT_EXPORT_REFERENCE_FIELDS.filter(
				(field) => field !== "personOrganizationClassification",
			),
		};
	}

	return null;
}

const CDS_COLLECTION_SOURCE_BY_ROWS_FIELD = {
	billItemRows: "billItems",
	valuationAdjustmentRows: "valuationAdjustments",
	transportScheduleRows: "transportSchedules",
	importLicenseRows: "importLicenses",
	otherLegalDocumentRows: "otherLegalDocumentCodes",
	electronicAttachmentRows: "electronicAttachments",
} as const;

/**
 * Collection writes only for repeat groups actually present in the payload, so
 * partial saves never wipe child rows the client did not send.
 */
function buildPresentCdsCollectionWrites(payload: CdsPayload) {
	const writes = buildCdsCollectionWrites(payload);
	return Object.fromEntries(
		Object.entries(writes).filter(
			([rowsField]) =>
				CDS_COLLECTION_SOURCE_BY_ROWS_FIELD[
					rowsField as keyof typeof CDS_COLLECTION_SOURCE_BY_ROWS_FIELD
				] in payload,
		),
	);
}

const CDS_NON_DATA_CHANGE_FIELDS = new Set([
	"id",
	"followUpId",
	"createdAt",
	"updatedAt",
	"cdsStatus",
	"ecusDeclarationId",
	"registeredAt",
	"registeredBy",
]);

const CDS_DECLARATION_LOCKED_CODE = "CDS_DECLARATION_LOCKED";

function normalizeComparableValue(value: unknown): unknown {
	if (value === undefined) {
		return null;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeComparableValue(item));
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, nestedValue]) => [
					key,
					normalizeComparableValue(nestedValue),
				]),
		);
	}

	return value;
}

function cdsValuesEqual(left: unknown, right: unknown): boolean {
	return (
		JSON.stringify(normalizeComparableValue(left)) ===
		JSON.stringify(normalizeComparableValue(right))
	);
}

function hasCdsDataChanges(
	existingRecord: Record<string, unknown> | null,
	sanitized: CdsPayload,
): boolean {
	if (!existingRecord) {
		return true;
	}

	return Object.entries(sanitized).some(([field, newValue]) => {
		if (CDS_NON_DATA_CHANGE_FIELDS.has(field)) {
			return false;
		}

		return !cdsValuesEqual(existingRecord[field] ?? null, newValue ?? null);
	});
}

function normalizeDeclarationNumber(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function isIssuedAppDeclaration(
	existingRecord: Record<string, unknown> | null,
) {
	if (!existingRecord) {
		return false;
	}

	const declarationNumber = normalizeDeclarationNumber(
		existingRecord.declarationNumber,
	);
	if (!declarationNumber) {
		return false;
	}

	return (
		existingRecord.cdsStatus === "REGISTERED" ||
		(existingRecord.ecusDeclarationId !== null &&
			existingRecord.ecusDeclarationId !== undefined)
	);
}

const FOLLOWUP_SYNC_DATE_FIELDS = new Set<CdsFollowUpSyncField>([
	"etaEtd",
	"transportDate",
]);

const FOLLOWUP_SYNC_INT_FIELDS = new Set<CdsFollowUpSyncField>(["quantity"]);

const FOLLOWUP_SYNC_NUMBER_FIELDS = new Set<CdsFollowUpSyncField>([
	"grossWeight",
]);

function normalizeComparableText(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function toDateOnly(value: unknown): string | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) {
		return null;
	}

	return date.toISOString().slice(0, 10);
}

function toPrismaDate(value: unknown): Date | null {
	const dateOnly = toDateOnly(value);
	if (!dateOnly) {
		return null;
	}

	const date = new Date(dateOnly);
	return Number.isNaN(date.getTime()) ? null : date;
}

function coerceFollowUpSyncValue(
	field: CdsFollowUpSyncField,
	value: string | number | null | undefined,
) {
	if (value === null || value === undefined || value === "") {
		return null;
	}

	if (FOLLOWUP_SYNC_DATE_FIELDS.has(field)) {
		return toPrismaDate(value);
	}

	if (FOLLOWUP_SYNC_INT_FIELDS.has(field)) {
		const number = Number.parseInt(String(value), 10);
		return Number.isFinite(number) ? number : null;
	}

	if (FOLLOWUP_SYNC_NUMBER_FIELDS.has(field)) {
		const number =
			typeof value === "number" ? value : Number.parseFloat(String(value));
		return Number.isFinite(number) ? number : null;
	}

	return normalizeComparableText(value);
}

function areFollowUpSyncValuesEqual(
	field: CdsFollowUpSyncField,
	left: unknown,
	right: unknown,
) {
	if (FOLLOWUP_SYNC_DATE_FIELDS.has(field)) {
		return toDateOnly(left) === toDateOnly(right);
	}

	// followUp.transportMethod stores free text ("FCL/SEA") while the CDS side
	// syncs the numeric VNACCS code; compare by mapped code so an equivalent
	// text value is never degraded to the bare digit.
	if (field === "transportMethod") {
		return (
			normalizeTransportMethodCode(left) === normalizeTransportMethodCode(right)
		);
	}

	if (FOLLOWUP_SYNC_INT_FIELDS.has(field)) {
		const leftNumber =
			left === null || left === undefined || left === ""
				? null
				: Number.parseInt(String(left), 10);
		const rightNumber =
			right === null || right === undefined || right === ""
				? null
				: Number.parseInt(String(right), 10);
		return leftNumber === rightNumber;
	}

	if (FOLLOWUP_SYNC_NUMBER_FIELDS.has(field)) {
		const leftNumber =
			left === null || left === undefined || left === "" ? null : Number(left);
		const rightNumber =
			right === null || right === undefined || right === ""
				? null
				: Number(right);
		return leftNumber === rightNumber;
	}

	return normalizeComparableText(left) === normalizeComparableText(right);
}

export async function GET(
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
			{ mode: "read" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				id: true,
				operationType: true,
				taxCode: true,
				companyName: true,
				domain: true,
				cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
			},
		});

		if (!followUp) {
			return NextResponse.json({ data: {} });
		}

		const cdsInfo = hydrateCdsCollections(
			followUp.cdsInfo,
		) as Partial<FollowUpCdsInfoRow>;
		const companySource = {
			...followUp,
			taxCode: normalizeTaxCode(cdsInfo?.importerCode) ?? followUp.taxCode,
		};

		const companyProfile = await resolvePartnerMasterDataForFollowUp({
			followUp: companySource,
			userSite: (session.user as { site?: string | null }).site,
		}).catch((error) => {
			console.error("Error resolving CDS partner master data:", error);
			return buildCompanyProfileFromFollowUp(companySource);
		});
		let hanConnectionError: string | null = null;
		const hasHanConnectionConfig = await hasHanConnectionConfigForTaxCode({
			taxCode: cdsInfo?.importerCode ?? followUp.taxCode,
			taxCodeCandidates: [followUp.taxCode],
			site: followUp.domain,
		});
		if (!hasHanConnectionConfig) {
			hanConnectionError =
				"Thiếu cấu hình data người dùng (dd_info) và chưa có HAN env override.";
		}
		const hanConnection = hasHanConnectionConfig
			? await withTimeout(
					resolveHanConnectionForTaxCode({
						taxCode: cdsInfo?.importerCode ?? followUp.taxCode,
						taxCodeCandidates: [followUp.taxCode],
						site: followUp.domain,
					}),
					CDS_STEP_TIMEOUT_MS,
					"Resolve HAN connection for CDS info",
				)
					.then(getHanConnectionPublicInfo)
					.catch((error) => {
						hanConnectionError =
							error instanceof Error
								? error.message
								: "Không xác định được data của người dùng.";
						console.error(
							"Error resolving user data source for CDS info:",
							error,
						);
						return null;
					})
			: null;

		const historyWhere = followUp.taxCode
			? { taxCode: followUp.taxCode }
			: followUp.companyName
				? { companyName: followUp.companyName }
				: null;

		const historicalRecords = historyWhere
			? await prismaRPA.followUp.findMany({
					take: 100,
					orderBy: [{ updatedAt: "desc" }],
					where: {
						id: { not: id },
						isDeleted: false,
						operationType: followUp.operationType ?? undefined,
						domain: followUp.domain ?? undefined,
						cdsInfo: { isNot: null },
						...historyWhere,
					},
					select: {
						id: true,
						jobNumber: true,
						taxCode: true,
						companyName: true,
						createdAt: true,
						cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
					},
				})
			: [];

		const crossOperationReferenceConfig = getCrossOperationReferenceConfig(
			followUp.operationType,
		);

		const crossOperationReferenceRecords =
			historyWhere && crossOperationReferenceConfig
				? await prismaRPA.followUp.findMany({
						take: 100,
						orderBy: [{ updatedAt: "desc" }],
						where: {
							id: { not: id },
							isDeleted: false,
							operationType:
								crossOperationReferenceConfig.referenceOperationType,
							cdsInfo: { isNot: null },
							...historyWhere,
						},
						select: {
							id: true,
							jobNumber: true,
							taxCode: true,
							companyName: true,
							createdAt: true,
							cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
						},
					})
				: [];

		const historyDefaults = buildCdsHistoryDefaults({
			records: historicalRecords,
			currentOperationCode: cdsInfo.operationCode,
		});
		const crossOperationReferenceDefaults = buildCdsHistoryDefaults({
			records: crossOperationReferenceRecords,
			fields:
				crossOperationReferenceConfig?.fields ??
				CDS_IMPORT_EXPORT_REFERENCE_FIELDS,
			sourceLabel:
				crossOperationReferenceConfig?.sourceLabel ??
				"Tham chiếu từ hồ sơ đối ứng",
		});

		return NextResponse.json({
			data: cdsInfo,
			companyProfile,
			hanConnection,
			hanConnectionError,
			historyDefaults: historyDefaults.data,
			historyDefaultMeta: historyDefaults.fieldMeta,
			crossOperationReferenceDefaults: crossOperationReferenceDefaults.data,
			crossOperationReferenceDefaultMeta:
				crossOperationReferenceDefaults.fieldMeta,
			exportReferenceDefaults: crossOperationReferenceDefaults.data,
			exportReferenceDefaultMeta: crossOperationReferenceDefaults.fieldMeta,
		});
	} catch (error) {
		console.error("Error fetching CDS info:", error);
		return NextResponse.json(
			{ error: "Internal Server Error" },
			{ status: 500 },
		);
	}
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
		const body = await req.json();
		const payload = body?.data;
		const preserveLifecycle = body?.preserveLifecycle === true;

		if (!payload || typeof payload !== "object") {
			return NextResponse.json(
				{ error: "Invalid data payload" },
				{ status: 400 },
			);
		}

		const permission = await checkFollowUpPermission(
			id,
			session.user.id,
			session.user.role ?? "",
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				operationType: true,
				domain: true,
				deliveryDate: true,
				requestTruckingNo: true,
				jobNumber: true,
				authority: true,
				workType: true,
				etaEtd: true,
				quantity: true,
				unit: true,
				grossWeight: true,
				invoice: true,
				poNumber: true,
				billOrBooking: true,
				pol: true,
				pod: true,
				transportDate: true,
				transportMethod: true,
				taxService: true,
			},
		});

		if (!followUp) {
			return NextResponse.json(
				{ error: "Follow-up not found" },
				{ status: 404 },
			);
		}

		const sanitized = sanitizeCdsInfoPayload(payload as CdsPayload);
		const followUpSyncPatch = buildFollowUpSyncPatchFromCdsInfo(
			sanitized as Partial<FollowUpCdsInfoRow>,
		);
		const nextBillOrBooking = followUpSyncPatch.billOrBooking;
		if (
			typeof nextBillOrBooking === "string" &&
			!areFollowUpSyncValuesEqual(
				"billOrBooking",
				followUp.billOrBooking,
				nextBillOrBooking,
			)
		) {
			const existingBill = await prismaRPA.followUp.findFirst({
				where: {
					billOrBooking: nextBillOrBooking,
					isDeleted: false,
					id: { not: id },
					domain: followUp.domain,
				},
				select: { jobNumber: true },
			});

			if (existingBill) {
				return NextResponse.json(
					{
						error: `Bill/Booking already exists in job ${existingBill.jobNumber || "unknown"}${followUp.domain ? ` for site ${followUp.domain}` : ""}`,
					},
					{ status: 400 },
				);
			}
		}

		const existing = await prismaRPA.followUpCdsInfo.findUnique({
			where: { followUpId: id },
			include: CDS_INFO_COLLECTION_INCLUDE,
		});
		const existingRecord = existing
			? (hydrateCdsCollections(existing) as Record<string, unknown>)
			: null;
		const hasDataChanges = hasCdsDataChanges(existingRecord, sanitized);

		if (
			!preserveLifecycle &&
			hasDataChanges &&
			isIssuedAppDeclaration(existingRecord)
		) {
			const declarationNumber = normalizeDeclarationNumber(
				existingRecord?.declarationNumber,
			);

			if (!declarationNumber) {
				return NextResponse.json(
					{
						code: CDS_DECLARATION_LOCKED_CODE,
						error:
							"Tờ khai đã được app cấp số nên không thể cập nhật trực tiếp từ web.",
					},
					{ status: 409 },
				);
			}

			let appSyncResult: AppDeclarationSyncResult;
			try {
				appSyncResult = await syncFollowUpDeclarationFromApp(id);
			} catch (syncError) {
				return NextResponse.json(
					{
						success: false,
						locked: true,
						code: CDS_DECLARATION_LOCKED_CODE,
						error:
							syncError instanceof Error
								? syncError.message
								: `Tờ khai ${declarationNumber} đã được app cấp số. Web đã chặn cập nhật nhưng chưa đồng bộ được dữ liệu từ app.`,
					},
					{ status: 409 },
				);
			}

			logFollowUpActivity(id, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_CDS_INFO",
				subResource: "cds_info",
				field: "declarationNumber",
				oldValue: declarationNumber,
				newValue: {
					declarationNumber:
						appSyncResult.declaration.declarationNumber ?? declarationNumber,
					code: CDS_DECLARATION_LOCKED_CODE,
					declarationId: appSyncResult.declaration.declarationId,
					sourceInfo: appSyncResult.sourceInfo,
				},
			});

			return NextResponse.json(
				{
					success: false,
					locked: true,
					code: CDS_DECLARATION_LOCKED_CODE,
					error: `Tờ khai ${declarationNumber} đã được app cấp số nên web không cập nhật trực tiếp. Đã đồng bộ lại dữ liệu mới nhất từ app.`,
					data: appSyncResult.saved,
					cargoList: appSyncResult.cargoList,
					appDeclaration: appSyncResult.declaration,
					sourceInfo: appSyncResult.sourceInfo,
				},
				{ status: 409 },
			);
		}

		const shouldResetLifecycle = !preserveLifecycle && hasDataChanges;
		const persistableData = toPrismaCdsScalarPayload(sanitized);
		const collectionWrites = buildPresentCdsCollectionWrites(sanitized);
		// The create branch must not carry `deleteMany` (invalid on nested create).
		const createCollectionWrites = Object.fromEntries(
			Object.entries(collectionWrites).map(([rowsField, write]) => [
				rowsField,
				{ create: (write as { create: unknown[] }).create },
			]),
		);
		const createData = {
			followUpId: id,
			...persistableData,
			...createCollectionWrites,
			...(shouldResetLifecycle ? CDS_DRAFT_LIFECYCLE_RESET : {}),
		} as Prisma.FollowUpCdsInfoUncheckedCreateInput;
		const updateData = {
			...persistableData,
			...collectionWrites,
			...(shouldResetLifecycle ? CDS_DRAFT_LIFECYCLE_RESET : {}),
		} as Prisma.FollowUpCdsInfoUncheckedUpdateInput;

		const saved = hydrateCdsCollections(
			await prismaRPA.followUpCdsInfo.upsert({
				where: { followUpId: id },
				create: createData,
				update: updateData,
				include: CDS_INFO_COLLECTION_INCLUDE,
			}),
		);

		const followUpUpdateData: Record<string, unknown> = {};
		const followUpActivityLogs: Array<{
			field: CdsFollowUpSyncField;
			oldValue: unknown;
			newValue: unknown;
		}> = [];

		Object.entries(followUpSyncPatch).forEach(([rawField, rawValue]) => {
			const field = rawField as CdsFollowUpSyncField;
			const nextValue = coerceFollowUpSyncValue(field, rawValue);
			if (nextValue === null || nextValue === undefined) {
				return;
			}

			const oldValue = followUp[field];
			if (areFollowUpSyncValuesEqual(field, oldValue, nextValue)) {
				return;
			}

			followUpUpdateData[field] = nextValue;
			followUpActivityLogs.push({ field, oldValue, newValue: nextValue });
		});

		if (
			followUpUpdateData.etaEtd instanceof Date &&
			!followUp.deliveryDate &&
			followUp.domain === "SGN"
		) {
			const computedDate = new Date(followUpUpdateData.etaEtd);
			computedDate.setDate(computedDate.getDate() + 2);
			followUpUpdateData.deliveryDate = computedDate;
		}

		if (Object.keys(followUpUpdateData).length > 0) {
			await prismaRPA.followUp.update({
				where: { id },
				data: followUpUpdateData as Prisma.FollowUpUncheckedUpdateInput,
			});

			if (followUpUpdateData.deliveryDate instanceof Date) {
				await prismaRPA.container.updateMany({
					where: {
						followUpId: id,
						truckingFollowUpId: null,
					},
					data: { implementationDate: followUpUpdateData.deliveryDate },
				});

				const truckingJobs = await prismaRPA.truckingFollowUp.findMany({
					where: {
						OR: [
							{ requestNumber: followUp.requestTruckingNo || "undefined" },
							...(followUp.jobNumber
								? [{ jobNumber: followUp.jobNumber }]
								: []),
						],
						isDeleted: false,
					},
					include: {
						containers: { select: { id: true } },
					},
				});

				for (const job of truckingJobs) {
					if (job.containers.length === 0) {
						await prismaRPA.truckingFollowUp.update({
							where: { id: job.id },
							data: { implementationDate: followUpUpdateData.deliveryDate },
						});

						await prismaRPA.fCR.updateMany({
							where: { truckingFollowUpId: job.id },
							data: { implementationDate: followUpUpdateData.deliveryDate },
						});
					}
				}
			}

			followUpActivityLogs.forEach((entry) => {
				logFollowUpActivity(id, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_FIELD",
					field: entry.field,
					oldValue: entry.oldValue,
					newValue: entry.newValue,
				});
			});
		}

		const skipKeys = new Set(["id", "followUpId", "createdAt", "updatedAt"]);
		Object.entries(sanitized).forEach(([field, newVal]) => {
			if (skipKeys.has(field)) {
				return;
			}

			const oldVal = existingRecord?.[field] ?? null;
			const nextVal = newVal ?? null;
			if (!cdsValuesEqual(oldVal, nextVal)) {
				logFollowUpActivity(id, {
					userId: session.user.id,
					userName: session.user.name,
					action: "UPDATE_CDS_INFO",
					subResource: "cds_info",
					field,
					oldValue: oldVal,
					newValue: nextVal,
				});
			}
		});

		return NextResponse.json({ success: true, data: saved });
	} catch (error) {
		console.error("Error saving CDS info:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
