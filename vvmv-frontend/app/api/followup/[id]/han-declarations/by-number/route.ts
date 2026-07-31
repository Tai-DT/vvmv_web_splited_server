import { type NextRequest, NextResponse } from "next/server";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { sanitizeCargoListPayload } from "@/lib/followup/ai-ocr-sync";
import {
	type CdsPayload,
	sanitizeCdsInfoPayload,
} from "@/lib/followup/cds-info-sanitize";
import {
	buildCdsCollectionCreates,
	buildCdsCollectionWrites,
	toPrismaCdsScalarPayload,
} from "@/lib/followup/cds-normalized-collections";
import { checkFollowUpPermission } from "@/lib/followup/check-permission";
import {
	getHanConnectionPublicInfo,
	resolveHanConnectionForTaxCode,
} from "@/lib/followup/han-connection";
import { loadHanDeclarationPrefillByNumber } from "@/lib/followup/han-declaration-loader";
import type { Prisma } from "@/prisma/client";

export const runtime = "nodejs";

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

		const declarationNumber = req.nextUrl.searchParams.get("declarationNumber");
		if (!declarationNumber?.trim()) {
			return NextResponse.json(
				{ error: "Missing declarationNumber" },
				{ status: 400 },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				taxCode: true,
				domain: true,
				cdsInfo: true,
			},
		});
		const cdsInfo =
			followUp?.cdsInfo as unknown as Partial<FollowUpCdsInfoRow> | null;
		const hanConnection = await resolveHanConnectionForTaxCode({
			taxCode: cdsInfo?.importerCode ?? followUp?.taxCode,
			taxCodeCandidates: [followUp?.taxCode],
			site: followUp?.domain,
		});
		const hanConnectionInfo = getHanConnectionPublicInfo(hanConnection);
		const data = await loadHanDeclarationPrefillByNumber({
			connectionString: hanConnection.connectionString,
			declarationNumber,
		});

		if (!data) {
			return NextResponse.json(
				{ error: "Không tìm thấy tờ khai tương ứng trong HAN_2024" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			data: {
				...data,
				cargoList: sanitizeCargoListPayload(data.cargoList),
			},
			hanConnection: hanConnectionInfo,
		});
	} catch (error) {
		console.error("Error loading HAN declaration prefill by number:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}

function clean(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	const text = clean(value);
	if (!text) {
		return null;
	}

	const parsed = Number(text.replace(/,/g, ""));
	return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}

	const text = clean(value);
	if (!text) {
		return null;
	}

	const date = new Date(text);
	return Number.isNaN(date.getTime()) ? null : date;
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
			{ mode: "write" },
		);

		if (!permission.ok) {
			return NextResponse.json(
				{ error: permission.error },
				{ status: permission.status },
			);
		}

		const body = await req.json().catch(() => ({}));
		const declarationNumber = clean(body?.declarationNumber);
		if (!declarationNumber) {
			return NextResponse.json(
				{ error: "Missing declarationNumber" },
				{ status: 400 },
			);
		}

		const followUp = await prismaRPA.followUp.findUnique({
			where: { id },
			select: {
				taxCode: true,
				domain: true,
				cdsInfo: true,
			},
		});

		if (!followUp) {
			return NextResponse.json(
				{ error: "Follow-up not found" },
				{ status: 404 },
			);
		}

		const cdsInfo =
			followUp.cdsInfo as unknown as Partial<FollowUpCdsInfoRow> | null;
		const hanConnection = await resolveHanConnectionForTaxCode({
			taxCode: cdsInfo?.importerCode ?? followUp.taxCode,
			taxCodeCandidates: [followUp.taxCode],
			site: followUp.domain,
		});
		const hanConnectionInfo = getHanConnectionPublicInfo(hanConnection);
		const data = await loadHanDeclarationPrefillByNumber({
			connectionString: hanConnection.connectionString,
			declarationNumber,
		});

		if (!data) {
			return NextResponse.json(
				{ error: "Không tìm thấy tờ khai tương ứng trong HAN_2024" },
				{ status: 404 },
			);
		}

		const sanitizedCdsInfo = sanitizeCdsInfoPayload(data.prefill as CdsPayload);
		const cargoList = sanitizeCargoListPayload(data.cargoList);
		const cargoCreateRows = cargoList.map((item) => ({
			followUpId: id,
			customCode: clean(item.customCode),
			hsCode: clean(item.hsCode),
			originalCountry: clean(item.originalCountry),
			originalCargoName: clean(item.originalCargoName),
			dutyReductionCode: clean(item.dutyReductionCode),
			imExDutyExemptionCode: clean(item.imExDutyExemptionCode),
			qty: toNumber(item.qty),
			unit: clean(item.unit),
			unitPrice: toNumber(item.unitPrice),
			totalPrice: toNumber(item.totalPrice),
			qty2: toNumber(item.qty2),
			unit2: clean(item.unit2),
			vietnameseName: clean(item.vietnameseName),
			importTaxCode: clean(item.importTaxCode),
			importTaxRate: toNumber(item.importTaxRate),
			importTaxAmount: toNumber(item.importTaxAmount),
			vatTaxCode: clean(item.vatTaxCode),
			vatTaxRate: toNumber(item.vatTaxRate),
			vatTaxAmount: toNumber(item.vatTaxAmount),
			imExDutyExemptionCondition: clean(item.imExDutyExemptionCondition),
			imExDutyExemptionAmount: toNumber(item.imExDutyExemptionAmount),
			importer: clean(item.importer),
			packageQty: toNumber(item.packageQty),
			packageType: clean(item.packageType),
			grossWeight: toNumber(item.grossWeight),
			invoiceNo: clean(item.invoiceNo),
			invoiceDate: toDate(item.invoiceDate),
			term: clean(item.term),
		}));

		const saved = await prismaRPA.$transaction(async (tx) => {
			const savedCds = await tx.followUpCdsInfo.upsert({
				where: { followUpId: id },
				create: {
					...(toPrismaCdsScalarPayload(
						sanitizedCdsInfo,
					) as Prisma.FollowUpCdsInfoCreateInput),
					followUp: { connect: { id } },
					...buildCdsCollectionCreates(sanitizedCdsInfo),
					// Sanitize drops app-issued declaration numbers; persist them
					// explicitly since this flow reads the registered declaration.
					declarationNumber: data.declarationNumber ?? declarationNumber,
					cdsStatus: "REGISTERED",
					ecusDeclarationId: data.declarationId,
				},
				update: {
					...(toPrismaCdsScalarPayload(
						sanitizedCdsInfo,
					) as Prisma.FollowUpCdsInfoUpdateInput),
					...buildCdsCollectionWrites(sanitizedCdsInfo),
					declarationNumber: data.declarationNumber ?? declarationNumber,
					cdsStatus: "REGISTERED",
					ecusDeclarationId: data.declarationId,
				},
			});

			await tx.cargoList.deleteMany({ where: { followUpId: id } });
			if (cargoCreateRows.length > 0) {
				await tx.cargoList.createMany({ data: cargoCreateRows });
			}

			return savedCds;
		});

		return NextResponse.json({
			success: true,
			readOnlySource: true,
			message:
				"Đã đọc tờ khai từ app/HAN và lưu vào web. Không ghi dữ liệu ngược sang app/HAN.",
			data: {
				cdsInfo: saved,
				cargoList,
				appDeclaration: {
					declarationId: data.declarationId,
					declarationNumber: data.declarationNumber,
					declarationDate: data.declarationDate,
				},
			},
			hanConnection: hanConnectionInfo,
		});
	} catch (error) {
		console.error("Error importing HAN declaration into web:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Internal Server Error",
			},
			{ status: 500 },
		);
	}
}
