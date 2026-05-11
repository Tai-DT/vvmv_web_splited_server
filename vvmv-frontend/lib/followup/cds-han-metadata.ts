import sql from "mssql";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";

export type HanColumnMetadata = {
	table: string;
	column: string;
	dataType: string | null;
	isNullable: boolean | null;
	maxLength: number | null;
	numericPrecision: number | null;
	numericScale: number | null;
};

const TARGET_TABLES = [
	"DTOKHAIMD",
	"DTOKHAIMD_VNACCS",
	"DTOKHAIMD_VNACCS2",
	"DHANGMDDK",
	"DDS_CONT_TK",
] as const;

const CACHE_TTL_MS = 10 * 60 * 1000;

type MetadataCacheState = {
	connectionKey: string;
	expiresAt: number;
	promise: Promise<Map<string, HanColumnMetadata>>;
};

const globalForHanMetadata = globalThis as unknown as {
	cdsHanMetadataCache?: MetadataCacheState;
};

function clean(value: unknown) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function toKey(table: string, column: string) {
	return `${table.toUpperCase()}::${column.toUpperCase()}`;
}

async function loadMetadataMap(connectionString: string | null | undefined) {
	const normalizedConnectionString = clean(connectionString);
	if (!normalizedConnectionString) {
		return new Map<string, HanColumnMetadata>();
	}
	const sqlConfig = parseMssqlConnectionString(normalizedConnectionString, {
		appName: "vvmv-cds-schema-readonly",
	});

	if (!sqlConfig) {
		return new Map<string, HanColumnMetadata>();
	}

	const pool = new sql.ConnectionPool(sqlConfig);

	await pool.connect();

	try {
		await pool
			.request()
			.query(
				"SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 5000;",
			);

		const result = await pool.request().query<{
			TABLE_NAME: string;
			COLUMN_NAME: string;
			DATA_TYPE: string | null;
			IS_NULLABLE: string | null;
			CHARACTER_MAXIMUM_LENGTH: number | null;
			NUMERIC_PRECISION: number | null;
			NUMERIC_SCALE: number | null;
		}>(`
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS WITH (NOLOCK)
      WHERE
        TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN (${TARGET_TABLES.map((table) => `'${table}'`).join(", ")})
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `);

		const map = new Map<string, HanColumnMetadata>();

		for (const row of result.recordset ?? []) {
			const table = clean(row.TABLE_NAME)?.toUpperCase();
			const column = clean(row.COLUMN_NAME)?.toUpperCase();

			if (!table || !column) {
				continue;
			}

			map.set(toKey(table, column), {
				table,
				column,
				dataType: clean(row.DATA_TYPE),
				isNullable:
					row.IS_NULLABLE === null
						? null
						: row.IS_NULLABLE.toUpperCase() === "YES",
				maxLength:
					typeof row.CHARACTER_MAXIMUM_LENGTH === "number"
						? row.CHARACTER_MAXIMUM_LENGTH
						: null,
				numericPrecision:
					typeof row.NUMERIC_PRECISION === "number"
						? row.NUMERIC_PRECISION
						: null,
				numericScale:
					typeof row.NUMERIC_SCALE === "number" ? row.NUMERIC_SCALE : null,
			});
		}

		return map;
	} finally {
		await pool.close();
	}
}

export async function getHanColumnMetadataMap(
	connectionString?: string | null,
) {
	const connectionKey = clean(connectionString);
	if (!connectionKey) {
		return new Map<string, HanColumnMetadata>();
	}

	const now = Date.now();
	const cached = globalForHanMetadata.cdsHanMetadataCache;

	if (
		cached &&
		cached.connectionKey === connectionKey &&
		cached.expiresAt > now
	) {
		return cached.promise;
	}

	const promise = loadMetadataMap(connectionKey);
	globalForHanMetadata.cdsHanMetadataCache = {
		connectionKey,
		expiresAt: now + CACHE_TTL_MS,
		promise,
	};

	return promise;
}

export async function getHanColumnMetadata(
	table: string,
	column: string,
	connectionString?: string | null,
) {
	const metadata = await getHanColumnMetadataMap(connectionString);
	return metadata.get(toKey(table, column)) ?? null;
}
