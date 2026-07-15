import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import { prismaRPA } from "@/lib/db";
import { sanitizeCargoListPayload } from "@/lib/followup/ai-ocr-sync";
import { loadAppDeclarationByNumber } from "@/lib/followup/app-declaration-source";
import {
	type CdsPayload,
	sanitizeCdsInfoPayload,
} from "@/lib/followup/cds-info-sanitize";
import {
	buildCdsCollectionWrites,
	CDS_INFO_COLLECTION_INCLUDE,
	hydrateCdsCollections,
	toPrismaCdsScalarPayload,
} from "@/lib/followup/cds-normalized-collections";
import type { Prisma } from "@/prisma/client";

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

	const parsed = Number(text);
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

export function isIssuedAppDeclaration(
	cdsInfo: Partial<FollowUpCdsInfoRow> | null | undefined,
) {
	return Boolean(
		clean(cdsInfo?.declarationNumber) &&
			(cdsInfo?.cdsStatus === "REGISTERED" ||
				cdsInfo?.ecusDeclarationId != null),
	);
}

export async function syncFollowUpDeclarationFromApp(followUpId: string) {
	const followUp = await prismaRPA.followUp.findUnique({
		where: { id: followUpId },
		select: {
			taxCode: true,
			domain: true,
			cdsInfo: { include: CDS_INFO_COLLECTION_INCLUDE },
		},
	});

	if (!followUp?.cdsInfo) {
		throw new Error("Chưa có dữ liệu CDS để đồng bộ từ app.");
	}

	const currentCdsInfo =
		followUp.cdsInfo as unknown as Partial<FollowUpCdsInfoRow>;
	if (!isIssuedAppDeclaration(currentCdsInfo)) {
		throw new Error(
			"Tờ khai chưa được app cấp số nên chưa cần đồng bộ từ app.",
		);
	}

	const declarationNumber = clean(currentCdsInfo.declarationNumber);
	if (!declarationNumber) {
		throw new Error("Thiếu số tờ khai để đồng bộ từ app.");
	}

	const { declaration, sourceInfo } = await loadAppDeclarationByNumber({
		declarationNumber,
		cdsInfo: currentCdsInfo,
		followUpTaxCode: followUp.taxCode,
		site: followUp.domain,
	});

	if (!declaration?.prefill) {
		throw new Error(`Không tìm thấy tờ khai ${declarationNumber} từ app.`);
	}

	const sanitizedCdsInfo = sanitizeCdsInfoPayload(
		declaration.prefill as CdsPayload,
	);
	const cargoList = sanitizeCargoListPayload(declaration.cargoList);
	const cdsUpdateData = {
		...(toPrismaCdsScalarPayload(
			sanitizedCdsInfo,
		) as Prisma.FollowUpCdsInfoUpdateInput),
		...buildCdsCollectionWrites(sanitizedCdsInfo),
		cdsStatus: "REGISTERED",
		ecusDeclarationId: declaration.declarationId,
	} as Prisma.FollowUpCdsInfoUpdateInput;
	const cargoCreateRows = cargoList.map((item) => ({
		followUpId,
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

	const saved = await prismaRPA.followUpCdsInfo.update({
		where: { followUpId },
		data: cdsUpdateData,
		include: CDS_INFO_COLLECTION_INCLUDE,
	});

	await prismaRPA.cargoList.deleteMany({ where: { followUpId } });
	if (cargoCreateRows.length > 0) {
		await prismaRPA.cargoList.createMany({
			data: cargoCreateRows,
		});
	}

	return {
		saved: hydrateCdsCollections(saved),
		cargoList,
		declaration,
		sourceInfo,
	};
}
