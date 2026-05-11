import type { HanConnectionPublicInfo } from "@/lib/followup/han-connection";

export type CdsHanConnectionInfo = HanConnectionPublicInfo;

function cleanText(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function cleanSite(value: unknown) {
	return value === "SGN" || value === "HAN" || value === "DAD" ? value : null;
}

export function parseCdsHanConnectionInfo(
	value: unknown,
): CdsHanConnectionInfo | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const record = value as Record<string, unknown>;
	const source = record.source;
	if (source !== "partners_master_data") {
		return null;
	}

	return {
		source,
		partnerId: cleanText(record.partnerId),
		taxCode: cleanText(record.taxCode),
		site: cleanSite(record.site),
		server: cleanText(record.server),
		port: typeof record.port === "number" ? record.port : null,
		database: cleanText(record.database),
		catalog: cleanText(record.catalog) ?? cleanText(record.database),
	};
}

export function getCdsHanConnectionSourceLabel(
	info: CdsHanConnectionInfo | null,
) {
	if (!info) {
		return "Chưa xác định";
	}

	return "DD Info khách hàng";
}

export function formatCdsHanConnectionCatalogLabel(
	info: CdsHanConnectionInfo | null,
) {
	if (!info) {
		return "Chưa xác định catalog";
	}

	const server = info.server
		? [info.server, info.port].filter(Boolean).join(":")
		: null;
	const catalog =
		(info.catalog ?? info.database)
			? `Catalog ${info.catalog ?? info.database}`
			: null;

	return (
		[server, catalog].filter(Boolean).join(" / ") || "Chưa xác định catalog"
	);
}
