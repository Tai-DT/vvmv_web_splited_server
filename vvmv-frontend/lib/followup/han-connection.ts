import { prismaRPA } from "@/lib/db";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";
import type { Site } from "@/prisma/client";

export type HanConnectionSource = "partners_master_data" | "env_override";

export type ResolvedHanConnection = {
	connectionString: string;
	source: HanConnectionSource;
	partnerId: string | null;
	taxCode: string | null;
	site: Site | null;
	server: string | null;
	port: number | null;
	database: string | null;
	catalog: string | null;
};

type PartnerHanConnection = {
	partner: {
		id: string;
		taxCode: string | null;
		site: Site;
		enableCDS: boolean;
		ddInfo: string | null;
	};
	connectionString: string;
	databaseInfo: HanConnectionDatabaseInfo;
};

type HanConnectionDatabaseInfo = {
	server: string | null;
	port: number | null;
	database: string | null;
	catalog: string | null;
};

type EnvHanConnection = {
	connectionString: string;
	databaseInfo: HanConnectionDatabaseInfo;
};

export type HanConnectionPublicInfo = Omit<
	ResolvedHanConnection,
	"connectionString"
>;

export function getHanConnectionPublicInfo(
	connection: ResolvedHanConnection,
): HanConnectionPublicInfo {
	return {
		source: connection.source,
		partnerId: connection.partnerId,
		taxCode: connection.taxCode,
		site: connection.site,
		server: connection.server,
		port: connection.port,
		database: connection.database,
		catalog: connection.catalog,
	};
}

function clean(value: unknown): string | null {
	const text = String(value ?? "").trim();
	return text || null;
}

function normalizeTaxCode(value: unknown): string | null {
	const digits = String(value ?? "").replace(/\D+/g, "");
	return digits || null;
}

function parseHanConnectionDatabaseInfo(
	value: string | null | undefined,
): HanConnectionDatabaseInfo | null {
	const config = parseMssqlConnectionString(value, {
		appName: "vvmv-han-connection-check",
	});

	if (!config) {
		return null;
	}

	return {
		server: clean(config.server),
		port: typeof config.port === "number" ? config.port : null,
		database: clean(config.database),
		catalog: clean(config.database),
	};
}

function parseEnvFlag(value: string | null | undefined) {
	const normalized = clean(value)?.toLowerCase();
	if (!normalized) {
		return null;
	}

	return ["true", "1", "yes"].includes(normalized);
}

function buildConnectionStringFromEnvParts() {
	const server = clean(process.env.HAN_DB_SERVER);
	const database = clean(process.env.HAN_DB_NAME);
	const user = clean(process.env.HAN_DB_USER);
	const password = clean(process.env.HAN_DB_PASSWORD);
	const encrypt = parseEnvFlag(process.env.HAN_DB_ENCRYPT);
	const trustServerCertificate = parseEnvFlag(
		process.env.HAN_DB_TRUST_SERVER_CERTIFICATE,
	);

	if (!server || !database || !user || !password) {
		return null;
	}

	const connectionParts = [
		`Server=${server}`,
		`Database=${database}`,
		`User ID=${user}`,
		`Password=${password}`,
		`Encrypt=${encrypt === true ? "True" : "False"}`,
		`TrustServerCertificate=${
			trustServerCertificate === false ? "False" : "True"
		}`,
	];

	return connectionParts.join(";");
}

function resolveHanConnectionFromEnv(): EnvHanConnection | null {
	const explicitConnectionString = clean(process.env.HAN_CONNECTION_OVERRIDE);
	const envConnectionString =
		explicitConnectionString ?? buildConnectionStringFromEnvParts();
	const databaseInfo = parseHanConnectionDatabaseInfo(envConnectionString);

	if (!envConnectionString || !databaseInfo) {
		return null;
	}

	return {
		connectionString: envConnectionString,
		databaseInfo,
	};
}

async function findPartnerHanConnection(
	taxCode: string,
	site: Site | null | undefined,
): Promise<PartnerHanConnection | null> {
	const partners = await prismaRPA.partnersMasterData.findMany({
		where: {
			taxCode,
		},
		orderBy: [{ updatedAt: "desc" }],
		select: {
			id: true,
			taxCode: true,
			site: true,
			enableCDS: true,
			ddInfo: true,
		},
	});
	const orderedPartners = site
		? [
				...partners.filter(
					(partner) => partner.site === site && partner.enableCDS,
				),
				...partners.filter(
					(partner) => partner.site === site && !partner.enableCDS,
				),
				...partners.filter(
					(partner) => partner.site !== site && partner.enableCDS,
				),
				...partners.filter(
					(partner) => partner.site !== site && !partner.enableCDS,
				),
			]
		: [
				...partners.filter((partner) => partner.enableCDS),
				...partners.filter((partner) => !partner.enableCDS),
			];

	for (const partner of orderedPartners) {
		const connectionString = clean(partner.ddInfo);
		const databaseInfo = parseHanConnectionDatabaseInfo(connectionString);
		if (connectionString && databaseInfo) {
			return { partner, connectionString, databaseInfo };
		}
	}

	return null;
}

async function findPartnerHanConnectionStatus(
	taxCode: string,
	_site: Site | null | undefined,
) {
	const partners = await prismaRPA.partnersMasterData.findMany({
		where: {
			taxCode,
		},
		orderBy: [{ updatedAt: "desc" }],
		select: {
			id: true,
			taxCode: true,
			site: true,
			enableCDS: true,
			ddInfo: true,
		},
	});

	if (partners.length === 0) {
		return {
			hasPartner: false,
			hasParseableConnection: false,
		};
	}

	const hasParseableConnection = partners.some((partner) => {
		const connectionString = clean(partner.ddInfo);
		return Boolean(
			connectionString && parseHanConnectionDatabaseInfo(connectionString),
		);
	});

	return {
		hasPartner: true,
		hasParseableConnection,
	};
}

function normalizeTaxCodeCandidates(values: unknown[]): string[] {
	const seen = new Set<string>();
	const candidates: string[] = [];

	for (const value of values) {
		const taxCode = normalizeTaxCode(value);
		if (!taxCode || seen.has(taxCode)) {
			continue;
		}

		seen.add(taxCode);
		candidates.push(taxCode);
	}

	return candidates;
}

export async function resolveHanConnectionForTaxCode(args: {
	taxCode?: string | null;
	taxCodeCandidates?: unknown[];
	site?: Site | null;
}): Promise<ResolvedHanConnection> {
	const taxCodes = normalizeTaxCodeCandidates([
		args.taxCode,
		...(args.taxCodeCandidates ?? []),
	]);

	for (const taxCode of taxCodes) {
		const partnerHanConnection = await findPartnerHanConnection(
			taxCode,
			args.site,
		);
		if (partnerHanConnection) {
			return {
				connectionString: partnerHanConnection.connectionString,
				source: "partners_master_data",
				partnerId: partnerHanConnection.partner.id,
				taxCode: partnerHanConnection.partner.taxCode ?? taxCode,
				site: partnerHanConnection.partner.site,
				...partnerHanConnection.databaseInfo,
			};
		}

		const partnerStatus = await findPartnerHanConnectionStatus(
			taxCode,
			args.site,
		);
		if (partnerStatus.hasPartner && !partnerStatus.hasParseableConnection) {
			throw new Error(
				`MST ${taxCode} có dữ liệu đối tác nhưng dd_info không hợp lệ. Vui lòng cập nhật đúng connection string SQL Server trong partners_master_data.dd_info; hệ thống đã chặn fallback để tránh ghi nhầm app.`,
			);
		}
	}

	const envHanConnection = resolveHanConnectionFromEnv();
	if (envHanConnection) {
		return {
			connectionString: envHanConnection.connectionString,
			source: "env_override",
			partnerId: null,
			taxCode: normalizeTaxCode(args.taxCode) ?? null,
			site: args.site ?? null,
			...envHanConnection.databaseInfo,
		};
	}

	throw new Error(
		taxCodes.length > 0
			? `Thiếu cấu hình data của người dùng hợp lệ cho MST ${taxCodes.join(", ")} trong partners_master_data và chưa cấu hình HAN env override. Không thể truyền qua app.`
			: "Thiếu MST để xác định data của người dùng và chưa cấu hình HAN env override. Không thể truyền qua app.",
	);
}

export async function hasHanConnectionConfigForTaxCode(args: {
	taxCode?: string | null;
	taxCodeCandidates?: unknown[];
	site?: Site | null;
}) {
	const taxCodes = normalizeTaxCodeCandidates([
		args.taxCode,
		...(args.taxCodeCandidates ?? []),
	]);

	for (const taxCode of taxCodes) {
		const partnerHanConnection = await findPartnerHanConnection(
			taxCode,
			args.site,
		);
		if (partnerHanConnection) {
			return true;
		}
	}

	if (resolveHanConnectionFromEnv()) {
		return true;
	}

	return false;
}

/**
 * HAN SQL Server connection string from environment only
 * (`HAN_CONNECTION_OVERRIDE` or `HAN_DB_*` parts).
 * For CLI/offline jobs that must not read Postgres / `partners_master_data`.
 */
export function getHanConnectionStringFromEnv(): string {
	const resolved = resolveHanConnectionFromEnv();
	if (!resolved) {
		throw new Error(
			"Thiếu cấu hình HAN: đặt HAN_CONNECTION_OVERRIDE hoặc HAN_DB_SERVER, HAN_DB_NAME, HAN_DB_USER, HAN_DB_PASSWORD.",
		);
	}
	return resolved.connectionString;
}
