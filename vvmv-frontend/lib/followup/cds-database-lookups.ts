import fs from "node:fs";
import path from "node:path";
import { ECUS_LEGAL_DOCUMENT_OPTIONS } from "@/app/(home)/internal/followup/_components/panels/ecus-legal-document-options";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
// Embed snapshot/catalog JSON as code dependencies so serverless bundlers
// (Vercel/etc.) always ship them, regardless of process.cwd() or tracing config.
import embeddedCdsLookupSnapshot from "@/database/exports/app_cds_lookups_latest/cds_database_lookups.json";
import embeddedBankCodesJson from "@/database/exports/cds_bank_codes.json";
import embeddedTruckLoadingCodesJson from "@/database/exports/cds_truck_loading_codes.json";
import { isAllowedVnaccsStandardFieldValue } from "@/lib/followup/cds-vnaccs-standard-rules";
import type { ProcessingDepartmentLookup } from "@/lib/followup/processing-department";

export type DeclarationDirection = "import" | "export" | "unknown";

export type DatabaseOperationCodeLookup = {
	code: string;
	name: string;
	direction: DeclarationDirection;
};

export type DatabaseImportLicenseLookup = {
	id: string;
	permitTypeCode: string | null;
	permitTypeName: string | null;
	permitNo: string;
	permitIssueDate: string | null;
	permitExpiryDate: string | null;
	declarationCount: number | null;
	firstDeclarationDate: string | null;
	lastDeclarationDate: string | null;
	sampleDeclarationNo: string | null;
	sampleCustomsCode: string | null;
	isExplicitImportLicense: boolean;
};

export type DatabasePermitLookup = {
	id: string;
	permitTypeCode: string | null;
	permitTypeName: string | null;
	permitNo: string;
	permitIssueDate: string | null;
	permitExpiryDate: string | null;
	declarationCount: number | null;
	firstDeclarationDate: string | null;
	lastDeclarationDate: string | null;
	sampleDeclarationNo: string | null;
	sampleCustomsCode: string | null;
	isExplicitImportLicense: boolean;
};

export type DatabasePermitTypeLookup = {
	code: string;
	name: string;
};

export type CdsDatabaseFieldOptionKey = Extract<
	keyof FollowUpCdsInfoRow,
	string
>;

export type DatabaseFieldOptionLookup = {
	field: CdsDatabaseFieldOptionKey;
	value: string;
	label?: string | null;
	address?: string | null;
	count: number;
	direction: DeclarationDirection;
	source: "header" | "vnaccs" | "app" | "app_saved";
};

export type DatabaseElectronicAttachmentLookup = {
	attachmentTypeCode: string;
	attachmentNumber: string | null;
	attachmentDescription: string | null;
	count: number;
};

export type CdsDatabaseLookups = {
	operationCodes: DatabaseOperationCodeLookup[];
	importLicenses: DatabaseImportLicenseLookup[];
	permits: DatabasePermitLookup[];
	permitTypes: DatabasePermitTypeLookup[];
	processingDepartments: ProcessingDepartmentLookup[];
	fieldOptions: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	>;
	electronicAttachments: DatabaseElectronicAttachmentLookup[];
};

const EXPORTS_DIR = path.join(process.cwd(), "database", "exports");
const LOOKUP_SNAPSHOT_FILE_NAME = "cds_database_lookups.json";
const LOOKUP_SNAPSHOT_PATH = path.join(
	EXPORTS_DIR,
	"app_cds_lookups_latest",
	LOOKUP_SNAPSHOT_FILE_NAME,
);
const DECLARATION_EXPORT_DIR = path.join(
	EXPORTS_DIR,
	"declaration_registration_export_latest",
);
const IMPORT_LICENSE_DISTINCT_PATH = path.join(
	EXPORTS_DIR,
	"import_license_distinct.csv",
);
const PERMIT_DISTINCT_PATH = path.join(EXPORTS_DIR, "permit_distinct.csv");
const PERMIT_CODE_MASTER_PATH = path.join(
	EXPORTS_DIR,
	"permit_code_master.csv",
);
const PERMIT_TYPE_CODES_JSON_PATH = path.join(
	EXPORTS_DIR,
	"cds_permit_type_codes.json",
);
const PERMIT_CODES_JSON_PATH = path.join(EXPORTS_DIR, "cds_permit_codes.json");
const HAN_SYNC_SNAPSHOT_DIR_PREFIX = "han2024_import_tables_";
const BANK_CODES_PATH = path.join(EXPORTS_DIR, "cds_bank_codes.json");
const TRUCK_LOADING_CODES_PATH = path.join(
	EXPORTS_DIR,
	"cds_truck_loading_codes.json",
);

let cachedSnapshotPath: string | null = null;
let cachedSnapshotLookups: CdsDatabaseLookups | null = null;
let cachedEmbeddedSnapshot: CdsDatabaseLookups | null | undefined;

function readEmbeddedLookupSnapshot(): CdsDatabaseLookups | null {
	if (cachedEmbeddedSnapshot !== undefined) {
		return cachedEmbeddedSnapshot;
	}
	try {
		cachedEmbeddedSnapshot =
			parseSnapshotLookups(embeddedCdsLookupSnapshot) ?? null;
	} catch (error) {
		console.warn("Failed to parse embedded CDS lookup snapshot:", error);
		cachedEmbeddedSnapshot = null;
	}
	return cachedEmbeddedSnapshot;
}

function stripBom(value: string) {
	return value.replace(/^\uFEFF/, "");
}

function normalizeText(value: string | null | undefined) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function normalizeDirection(
	value: string | null | undefined,
): DeclarationDirection {
	const normalized = normalizeText(value)?.toLowerCase();
	if (normalized === "import" || normalized === "export") {
		return normalized;
	}
	return "unknown";
}

function parseCsvRows(content: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentCell = "";
	let inQuotes = false;

	const pushCell = () => {
		currentRow.push(stripBom(currentCell).trim());
		currentCell = "";
	};

	const pushRow = () => {
		if (currentRow.every((cell) => cell === "")) {
			currentRow = [];
			return;
		}

		rows.push(currentRow);
		currentRow = [];
	};

	for (let index = 0; index < content.length; index += 1) {
		const char = content[index];

		if (char === '"') {
			if (inQuotes && content[index + 1] === '"') {
				currentCell += '"';
				index += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}

		if (char === "," && !inQuotes) {
			pushCell();
			continue;
		}

		if ((char === "\n" || char === "\r") && !inQuotes) {
			pushCell();
			pushRow();

			if (char === "\r" && content[index + 1] === "\n") {
				index += 1;
			}
			continue;
		}

		currentCell += char;
	}

	if (currentCell !== "" || currentRow.length > 0) {
		pushCell();
		pushRow();
	}

	return rows;
}

function readCsvRecords(filePath: string): Array<Record<string, string>> {
	if (!fs.existsSync(filePath)) {
		return [];
	}

	const content = stripBom(fs.readFileSync(filePath, "utf8"));
	const rows = parseCsvRows(content);

	if (rows.length === 0) {
		return [];
	}

	const headers = rows[0].map((header) => stripBom(header));
	return rows.slice(1).map((cells) => {
		const row: Record<string, string> = {};

		headers.forEach((header, index) => {
			row[header] = stripBom(cells[index] ?? "");
		});

		return row;
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFieldOptionLookupList(
	value: unknown,
	fallbackField?: CdsDatabaseFieldOptionKey,
): DatabaseFieldOptionLookup[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const lookups: Array<DatabaseFieldOptionLookup | null> = value.map((item) => {
		if (!isRecord(item)) {
			return null;
		}

		const field = normalizeText(
			typeof item.field === "string" ? item.field : fallbackField,
		);
		const rawValue = normalizeText(String(item.value ?? ""));

		if (!field || !rawValue) {
			return null;
		}

		const fieldKey = field as CdsDatabaseFieldOptionKey;
		if (!isAllowedVnaccsStandardFieldValue(fieldKey, rawValue)) {
			return null;
		}

		const source =
			item.source === "header" ||
			item.source === "vnaccs" ||
			item.source === "app" ||
			item.source === "app_saved"
				? item.source
				: "header";

		return {
			field: fieldKey,
			value: rawValue,
			label: normalizeText(
				typeof item.label === "string" ? item.label : undefined,
			),
			address: normalizeText(
				typeof item.address === "string" ? item.address : undefined,
			),
			count:
				typeof item.count === "number"
					? item.count
					: (parseInteger(String(item.count ?? "")) ?? 0),
			direction: normalizeDirection(
				typeof item.direction === "string" ? item.direction : undefined,
			),
			source,
		};
	});

	return lookups.filter(
		(item): item is DatabaseFieldOptionLookup => item !== null,
	);
}

function parseSnapshotLookups(value: unknown): CdsDatabaseLookups | null {
	if (!isRecord(value)) {
		return null;
	}

	const payload = isRecord(value.data) ? value.data : value;
	if (!isRecord(payload)) {
		return null;
	}

	const fieldOptions: CdsDatabaseLookups["fieldOptions"] = {};

	if (isRecord(payload.fieldOptions)) {
		Object.entries(payload.fieldOptions).forEach(([fieldKey, options]) => {
			const parsed = toFieldOptionLookupList(
				options,
				fieldKey as CdsDatabaseFieldOptionKey,
			);
			if (parsed && parsed.length > 0) {
				fieldOptions[fieldKey as CdsDatabaseFieldOptionKey] = parsed;
			}
		});
	}

	const operationCodes = Array.isArray(payload.operationCodes)
		? payload.operationCodes
				.map((item) => {
					if (!isRecord(item)) {
						return null;
					}

					const code = normalizeText(
						typeof item.code === "string" ? item.code : undefined,
					);
					const name = normalizeText(
						typeof item.name === "string" ? item.name : undefined,
					);

					if (!code || !name) {
						return null;
					}

					return {
						code,
						name,
						direction: normalizeDirection(
							typeof item.direction === "string" ? item.direction : undefined,
						),
					} satisfies DatabaseOperationCodeLookup;
				})
				.filter((item): item is DatabaseOperationCodeLookup => item !== null)
		: [];

	const parsePermitList = <T extends DatabasePermitLookup>(
		rawValue: unknown,
	): T[] =>
		Array.isArray(rawValue)
			? rawValue
					.map((item) => {
						if (!isRecord(item)) {
							return null;
						}

						const id = normalizeText(
							typeof item.id === "string" ? item.id : undefined,
						);
						const permitNo = normalizeText(
							typeof item.permitNo === "string" ? item.permitNo : undefined,
						);

						if (!id || !permitNo) {
							return null;
						}

						return {
							id,
							permitTypeCode: normalizeText(
								typeof item.permitTypeCode === "string"
									? item.permitTypeCode
									: undefined,
							),
							permitTypeName: normalizeText(
								typeof item.permitTypeName === "string"
									? item.permitTypeName
									: undefined,
							),
							permitNo,
							permitIssueDate: normalizeText(
								typeof item.permitIssueDate === "string"
									? item.permitIssueDate
									: undefined,
							),
							permitExpiryDate: normalizeText(
								typeof item.permitExpiryDate === "string"
									? item.permitExpiryDate
									: undefined,
							),
							declarationCount:
								typeof item.declarationCount === "number"
									? item.declarationCount
									: parseInteger(String(item.declarationCount ?? "")),
							firstDeclarationDate: normalizeText(
								typeof item.firstDeclarationDate === "string"
									? item.firstDeclarationDate
									: undefined,
							),
							lastDeclarationDate: normalizeText(
								typeof item.lastDeclarationDate === "string"
									? item.lastDeclarationDate
									: undefined,
							),
							sampleDeclarationNo: normalizeText(
								typeof item.sampleDeclarationNo === "string"
									? item.sampleDeclarationNo
									: undefined,
							),
							sampleCustomsCode: normalizeText(
								typeof item.sampleCustomsCode === "string"
									? item.sampleCustomsCode
									: undefined,
							),
							isExplicitImportLicense: Boolean(item.isExplicitImportLicense),
						} satisfies DatabasePermitLookup;
					})
					.filter((item): item is T => item !== null)
			: [];

	const permitTypes = Array.isArray(payload.permitTypes)
		? payload.permitTypes
				.map((item) => {
					if (!isRecord(item)) {
						return null;
					}

					const code = normalizeText(
						typeof item.code === "string" ? item.code : undefined,
					);
					const name = normalizeText(
						typeof item.name === "string" ? item.name : undefined,
					);

					if (!code || !name) {
						return null;
					}

					return { code, name } satisfies DatabasePermitTypeLookup;
				})
				.filter((item): item is DatabasePermitTypeLookup => item !== null)
		: [];

	const processingDepartments = Array.isArray(payload.processingDepartments)
		? payload.processingDepartments
				.map((item) => {
					if (!isRecord(item)) {
						return null;
					}

					const code = normalizeText(
						typeof item.code === "string" ? item.code : undefined,
					);
					const customsCode = normalizeText(
						typeof item.customsCode === "string" ? item.customsCode : undefined,
					);

					if (!code || !customsCode) {
						return null;
					}

					return {
						code,
						customsCode,
						name: normalizeText(
							typeof item.name === "string" ? item.name : undefined,
						),
						operationCodes: Array.isArray(item.operationCodes)
							? item.operationCodes
									.map((operationCode) =>
										normalizeText(
											typeof operationCode === "string"
												? operationCode
												: undefined,
										),
									)
									.filter((operationCode): operationCode is string =>
										Boolean(operationCode),
									)
							: [],
						allowImport: Boolean(item.allowImport),
						allowExport: Boolean(item.allowExport),
					} satisfies ProcessingDepartmentLookup;
				})
				.filter((item): item is ProcessingDepartmentLookup => item !== null)
		: [];

	const electronicAttachments = Array.isArray(payload.electronicAttachments)
		? payload.electronicAttachments
				.map((item) => {
					if (!isRecord(item)) {
						return null;
					}

					const attachmentTypeCode = normalizeText(
						typeof item.attachmentTypeCode === "string"
							? item.attachmentTypeCode
							: undefined,
					);

					if (!attachmentTypeCode) {
						return null;
					}

					return {
						attachmentTypeCode,
						attachmentNumber: normalizeText(
							typeof item.attachmentNumber === "string"
								? item.attachmentNumber
								: undefined,
						),
						attachmentDescription: normalizeText(
							typeof item.attachmentDescription === "string"
								? item.attachmentDescription
								: undefined,
						),
						count:
							typeof item.count === "number"
								? item.count
								: (parseInteger(String(item.count ?? "")) ?? 0),
					} satisfies DatabaseElectronicAttachmentLookup;
				})
				.filter(
					(item): item is DatabaseElectronicAttachmentLookup => item !== null,
				)
		: [];

	return {
		operationCodes,
		importLicenses: parsePermitList<DatabaseImportLicenseLookup>(
			payload.importLicenses,
		),
		permits: parsePermitList<DatabasePermitLookup>(payload.permits),
		permitTypes,
		processingDepartments,
		fieldOptions,
		electronicAttachments,
	};
}

function findLatestHanLookupSnapshotPath() {
	return fs.existsSync(LOOKUP_SNAPSHOT_PATH) ? LOOKUP_SNAPSHOT_PATH : null;
}

/**
 * Scans `database/exports` for `han2024_import_tables_*` snapshot directories created by
 * `sync:cds-lookups` and returns the newest snapshot file path, if any.
 */
function findLatestHanSyncSnapshotPath() {
	if (!fs.existsSync(EXPORTS_DIR)) {
		return null;
	}

	const directories = fs
		.readdirSync(EXPORTS_DIR, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				entry.name.startsWith(HAN_SYNC_SNAPSHOT_DIR_PREFIX),
		)
		.map((entry) => entry.name)
		.sort((left, right) => right.localeCompare(left, "en"));

	for (const directoryName of directories) {
		const candidate = path.join(
			EXPORTS_DIR,
			directoryName,
			LOOKUP_SNAPSHOT_FILE_NAME,
		);
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

let cachedHanSyncSnapshotPath: string | null = null;
let cachedHanSyncSnapshotLookups: CdsDatabaseLookups | null = null;

function readHanSyncSnapshot(): CdsDatabaseLookups | null {
	const snapshotPath = findLatestHanSyncSnapshotPath();
	if (!snapshotPath) {
		cachedHanSyncSnapshotPath = null;
		cachedHanSyncSnapshotLookups = null;
		return null;
	}

	if (
		cachedHanSyncSnapshotPath === snapshotPath &&
		cachedHanSyncSnapshotLookups
	) {
		return cachedHanSyncSnapshotLookups;
	}

	try {
		const content = fs.readFileSync(snapshotPath, "utf8");
		const parsed = parseSnapshotLookups(JSON.parse(content));
		if (!parsed) {
			return null;
		}
		cachedHanSyncSnapshotPath = snapshotPath;
		cachedHanSyncSnapshotLookups = parsed;
		return parsed;
	} catch (error) {
		console.warn("Failed to read HAN sync snapshot for permits:", error);
		return null;
	}
}

function toPermitTypeJsonLookups(): DatabasePermitTypeLookup[] {
	if (!fs.existsSync(PERMIT_TYPE_CODES_JSON_PATH)) {
		return [];
	}

	try {
		const parsed = JSON.parse(
			fs.readFileSync(PERMIT_TYPE_CODES_JSON_PATH, "utf8"),
		);
		const rows = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
		const result: DatabasePermitTypeLookup[] = [];
		const seen = new Set<string>();

		for (const row of rows) {
			const code = normalizeText(
				typeof row.code === "string"
					? row.code
					: typeof row.value === "string"
						? row.value
						: undefined,
			)?.toUpperCase();
			const name = normalizeText(
				typeof row.name === "string"
					? row.name
					: typeof row.label === "string"
						? row.label
						: undefined,
			);

			if (!code || !name || seen.has(code)) {
				continue;
			}

			seen.add(code);
			result.push({ code, name });
		}

		return result.sort((left, right) =>
			left.code.localeCompare(right.code, "en", { numeric: true }),
		);
	} catch (error) {
		console.warn("Failed to read cds_permit_type_codes.json:", error);
		return [];
	}
}

type PermitJsonLookups = {
	importLicenses: DatabaseImportLicenseLookup[];
	permits: DatabasePermitLookup[];
	permitTypes: DatabasePermitTypeLookup[];
};

/**
 * Reads `cds_permit_codes.json` written by `scripts/sync-permit-catalog.ts`
 * (read-only HAN scrape). Each row already lists `permitNo` + permitTypeCode/name,
 * so we synthesize lookup entries for both `permits` and `importLicenses` and
 * also harvest any new permit-type codes seen alongside the data.
 */
function toPermitCodeJsonLookups(): PermitJsonLookups {
	if (!fs.existsSync(PERMIT_CODES_JSON_PATH)) {
		return { importLicenses: [], permits: [], permitTypes: [] };
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(PERMIT_CODES_JSON_PATH, "utf8"));
		const rows = Array.isArray(parsed) ? parsed.filter(isRecord) : [];

		const importLicenses: DatabaseImportLicenseLookup[] = [];
		const permits: DatabasePermitLookup[] = [];
		const permitTypeMap = new Map<string, DatabasePermitTypeLookup>();

		for (const row of rows) {
			const permitNo = normalizeText(
				typeof row.permitNo === "string"
					? row.permitNo
					: typeof row.value === "string"
						? row.value
						: undefined,
			);
			if (!permitNo) {
				continue;
			}

			const permitTypeCode =
				normalizeText(
					typeof row.permitTypeCode === "string"
						? row.permitTypeCode
						: undefined,
				)?.toUpperCase() ?? null;
			const permitTypeName = normalizeText(
				typeof row.permitTypeName === "string" ? row.permitTypeName : undefined,
			);
			const count =
				typeof row.count === "number"
					? row.count
					: (parseInteger(String(row.count ?? "")) ?? 0);

			const id = `${permitTypeCode ?? "NO_TYPE"}::${permitNo}`;
			const baseEntry = {
				id,
				permitTypeCode,
				permitTypeName,
				permitNo,
				permitIssueDate: null,
				permitExpiryDate: null,
				declarationCount: count > 0 ? count : null,
				firstDeclarationDate: null,
				lastDeclarationDate: null,
				sampleDeclarationNo: null,
				sampleCustomsCode: null,
				isExplicitImportLicense: false,
			};

			importLicenses.push({ ...baseEntry, isExplicitImportLicense: true });
			permits.push(baseEntry);

			if (
				permitTypeCode &&
				permitTypeName &&
				!permitTypeMap.has(permitTypeCode)
			) {
				permitTypeMap.set(permitTypeCode, {
					code: permitTypeCode,
					name: permitTypeName,
				});
			}
		}

		return {
			importLicenses,
			permits,
			permitTypes: [...permitTypeMap.values()],
		};
	} catch (error) {
		console.warn("Failed to read cds_permit_codes.json:", error);
		return { importLicenses: [], permits: [], permitTypes: [] };
	}
}

function readLookupSnapshot() {
	const snapshotPath = findLatestHanLookupSnapshotPath();

	if (!snapshotPath) {
		cachedSnapshotPath = null;
		cachedSnapshotLookups = null;
		// No file on disk (typical for serverless deploys): fall back to embedded JSON.
		return readEmbeddedLookupSnapshot();
	}

	if (cachedSnapshotPath === snapshotPath && cachedSnapshotLookups) {
		return cachedSnapshotLookups;
	}

	try {
		const content = fs.readFileSync(snapshotPath, "utf8");
		const parsed = parseSnapshotLookups(JSON.parse(content));

		if (!parsed) {
			return readEmbeddedLookupSnapshot();
		}

		cachedSnapshotPath = snapshotPath;
		cachedSnapshotLookups = parsed;
		return parsed;
	} catch (error) {
		console.warn("Failed to read CDS lookup snapshot:", error);
		return readEmbeddedLookupSnapshot();
	}
}

function findLatestDeclarationLookupPath() {
	const exportDir = findLatestDeclarationExportDir();
	return exportDir ? path.join(exportDir, "declaration_type_lookup.csv") : null;
}

function findLatestDeclarationExportDir() {
	return fs.existsSync(DECLARATION_EXPORT_DIR) ? DECLARATION_EXPORT_DIR : null;
}

function readLatestDeclarationExportRows(fileName: string) {
	const exportDir = findLatestDeclarationExportDir();
	if (!exportDir) {
		return [];
	}

	return readCsvRecords(path.join(exportDir, fileName));
}

function parseInteger(value: string | null | undefined) {
	const normalized = normalizeText(value);
	if (!normalized) {
		return null;
	}

	const parsed = Number.parseInt(normalized, 10);
	return Number.isFinite(parsed) ? parsed : null;
}

function toOperationCodeLookups(): DatabaseOperationCodeLookup[] {
	const declarationLookupPath = findLatestDeclarationLookupPath();
	if (!declarationLookupPath) {
		return [];
	}

	const rows = readCsvRecords(declarationLookupPath);
	const deduped = new Map<string, DatabaseOperationCodeLookup>();

	for (const row of rows) {
		const code = normalizeText(row.MA_LOAI_HINH);
		const name = normalizeText(row.TEN_LOAI_HINH);
		if (!code || !name) {
			continue;
		}

		deduped.set(code, {
			code,
			name,
			direction: normalizeDirection(row.DECLARATION_DIRECTION),
		});
	}

	return [...deduped.values()].sort((left, right) =>
		left.code.localeCompare(right.code, "en", { numeric: true }),
	);
}

function toImportLicenseLookups(): DatabaseImportLicenseLookup[] {
	const rows = readCsvRecords(IMPORT_LICENSE_DISTINCT_PATH);
	return toPermitLookups(rows);
}

function toPermitLookups(
	rows: Array<Record<string, string>>,
): DatabasePermitLookup[] {
	const deduped = new Map<string, DatabasePermitLookup>();

	for (const row of rows) {
		const permitNo = normalizeText(row.permit_no);
		if (!permitNo) {
			continue;
		}

		const permitTypeCode = normalizeText(row.permit_type_code);
		const id = `${permitTypeCode ?? "NO_TYPE"}::${permitNo}`;

		deduped.set(id, {
			id,
			permitTypeCode,
			permitTypeName: normalizeText(row.permit_type_name),
			permitNo,
			permitIssueDate: normalizeText(row.permit_issue_date),
			permitExpiryDate: normalizeText(row.permit_expiry_date),
			declarationCount: parseInteger(row.declaration_count),
			firstDeclarationDate: normalizeText(row.first_declaration_date),
			lastDeclarationDate: normalizeText(row.last_declaration_date),
			sampleDeclarationNo: normalizeText(row.sample_declaration_no),
			sampleCustomsCode: normalizeText(row.sample_customs_code),
			isExplicitImportLicense:
				normalizeText(row.is_explicit_import_license) === "1",
		});
	}

	return [...deduped.values()].sort((left, right) => {
		if (left.isExplicitImportLicense !== right.isExplicitImportLicense) {
			return (
				Number(right.isExplicitImportLicense) -
				Number(left.isExplicitImportLicense)
			);
		}

		const dateCompare = (right.lastDeclarationDate ?? "").localeCompare(
			left.lastDeclarationDate ?? "",
			"en",
		);
		if (dateCompare !== 0) {
			return dateCompare;
		}

		const declarationCountCompare =
			(right.declarationCount ?? 0) - (left.declarationCount ?? 0);
		if (declarationCountCompare !== 0) {
			return declarationCountCompare;
		}

		return left.permitNo.localeCompare(right.permitNo, "en", {
			numeric: true,
		});
	});
}

function toGeneralPermitLookups(): DatabasePermitLookup[] {
	const rows = readCsvRecords(PERMIT_DISTINCT_PATH);
	return toPermitLookups(rows);
}

function toPermitTypeLookups(): DatabasePermitTypeLookup[] {
	const rows = readCsvRecords(PERMIT_CODE_MASTER_PATH);
	const deduped = new Map<string, DatabasePermitTypeLookup>();

	for (const row of rows) {
		const code = normalizeText(row.Ma_Loai_GP);
		const name =
			normalizeText(row.Ten_Loai_GP) ?? normalizeText(row.Ten_Loai_GP1);

		if (!code || !name) {
			continue;
		}

		deduped.set(code, { code, name });
	}

	return [...deduped.values()].sort((left, right) =>
		left.code.localeCompare(right.code, "en", { numeric: true }),
	);
}

function toTruckLoadingCodeLookups(): DatabaseFieldOptionLookup[] {
	const parsed = fs.existsSync(TRUCK_LOADING_CODES_PATH)
		? (JSON.parse(fs.readFileSync(TRUCK_LOADING_CODES_PATH, "utf8")) as unknown)
		: (embeddedTruckLoadingCodesJson as unknown);
	const rows = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
	const options: DatabaseFieldOptionLookup[] = [];

	for (const row of rows) {
		const value = normalizeText(String(row.code ?? ""))?.toUpperCase();
		if (!value) {
			continue;
		}

		options.push({
			field: "truckLoadingLocationCode",
			value,
			label: normalizeText(typeof row.name === "string" ? row.name : undefined),
			address: normalizeText(
				typeof row.address === "string" ? row.address : undefined,
			),
			count: typeof row.usedCount === "number" ? row.usedCount : 0,
			direction: "unknown",
			source: "header",
		});
	}

	return options.sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return left.value.localeCompare(right.value, "en", { numeric: true });
	});
}

function getFallbackCatalogCount(row: Record<string, unknown>, index: number) {
	if (typeof row.usedCount === "number") {
		return row.usedCount;
	}

	if (typeof row.count === "number") {
		return row.count;
	}

	if (typeof row.sortOrder === "number") {
		return Math.max(1_000_000 - row.sortOrder + 1, 1);
	}

	return Math.max(1_000_000 - index, 1);
}

function toBankCodeLookups(
	field: "taxSubstituteBankCode" | "guaranteeBankCode",
): DatabaseFieldOptionLookup[] {
	const parsed = fs.existsSync(BANK_CODES_PATH)
		? (JSON.parse(fs.readFileSync(BANK_CODES_PATH, "utf8")) as unknown)
		: (embeddedBankCodesJson as unknown);
	const rows = Array.isArray(parsed) ? parsed.filter(isRecord) : [];
	const options: DatabaseFieldOptionLookup[] = [];

	rows.forEach((row, index) => {
		const value = normalizeText(
			String(row.code ?? row.value ?? ""),
		)?.toUpperCase();
		if (!value) {
			return;
		}

		options.push({
			field,
			value,
			label: normalizeText(
				typeof row.name === "string"
					? row.name
					: typeof row.label === "string"
						? row.label
						: undefined,
			),
			count: getFallbackCatalogCount(row, index),
			direction: "unknown",
			source: "app",
		});
	});

	return options.sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return left.value.localeCompare(right.value, "en", { numeric: true });
	});
}

function mergeTruckLoadingCodeLookups(
	currentOptions: DatabaseFieldOptionLookup[] | undefined,
	fallbackOptions: DatabaseFieldOptionLookup[],
) {
	if (fallbackOptions.length === 0) {
		return currentOptions ?? [];
	}

	const merged = new Map<string, DatabaseFieldOptionLookup>();

	[...(currentOptions ?? []), ...fallbackOptions].forEach((option) => {
		const value = normalizeText(option.value)?.toUpperCase();
		if (!value) {
			return;
		}

		const key = `${option.direction}::${value}`;
		const existing = merged.get(key);

		merged.set(key, {
			...option,
			value,
			label: option.label || existing?.label || null,
			address: option.address || existing?.address || null,
			count: Math.max(option.count, existing?.count ?? 0),
		});
	});

	return [...merged.values()].sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return left.value.localeCompare(right.value, "en", { numeric: true });
	});
}

function mergeCatalogFieldLookups(
	currentOptions: DatabaseFieldOptionLookup[] | undefined,
	fallbackOptions: DatabaseFieldOptionLookup[],
) {
	if (fallbackOptions.length === 0) {
		return currentOptions ?? [];
	}

	const merged = new Map<string, DatabaseFieldOptionLookup>();

	[...(currentOptions ?? []), ...fallbackOptions].forEach((option) => {
		const value = normalizeText(option.value)?.toUpperCase();
		if (!value) {
			return;
		}

		const key = `${option.direction}::${value}`;
		const existing = merged.get(key);

		merged.set(key, {
			...option,
			value,
			label: existing?.label || option.label || null,
			address: existing?.address || option.address || null,
			count: Math.max(option.count, existing?.count ?? 0),
		});
	});

	return [...merged.values()].sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		return left.value.localeCompare(right.value, "en", { numeric: true });
	});
}

/**
 * Live HAN unions DAM_BAO_MA_NG_HANG (header) and BL_THUE_MA_NG_HANG (VNACCS2).
 * CSV snapshot only fills taxSubstituteBankCode from vnaccs2; merge in bảo lãnh codes
 * so the mirror matches live when BL_THUE is sparse.
 */
function mergeTaxSubstituteBankLookups(
	blThueOptions: DatabaseFieldOptionLookup[] | undefined,
	guaranteeOptions: DatabaseFieldOptionLookup[] | undefined,
): DatabaseFieldOptionLookup[] {
	const merged = new Map<string, DatabaseFieldOptionLookup>();

	const add = (option: DatabaseFieldOptionLookup) => {
		const value = normalizeText(option.value)?.toUpperCase();
		if (!value) {
			return;
		}

		const key = `${option.direction}::${value}`;
		const existing = merged.get(key);

		if (existing) {
			existing.count += option.count;
			if (!existing.label && option.label) {
				existing.label = option.label;
			}
			return;
		}

		merged.set(key, {
			...option,
			field: "taxSubstituteBankCode",
			value,
		});
	};

	(blThueOptions ?? []).forEach(add);
	(guaranteeOptions ?? []).forEach(add);

	return [...merged.values()].sort((left, right) => {
		if (right.count !== left.count) {
			return right.count - left.count;
		}

		if (left.direction !== right.direction) {
			return left.direction.localeCompare(right.direction, "en");
		}

		return left.value.localeCompare(right.value, "en", { numeric: true });
	});
}

function withTaxSubstituteBankFieldMerge(
	lookups: CdsDatabaseLookups,
): CdsDatabaseLookups {
	return {
		...lookups,
		fieldOptions: {
			...lookups.fieldOptions,
			taxSubstituteBankCode: mergeTaxSubstituteBankLookups(
				lookups.fieldOptions.taxSubstituteBankCode,
				lookups.fieldOptions.guaranteeBankCode,
			),
		},
	};
}

function withBankCodeFallback(lookups: CdsDatabaseLookups): CdsDatabaseLookups {
	const taxSubstituteBankOptions = toBankCodeLookups("taxSubstituteBankCode");
	const guaranteeBankOptions = toBankCodeLookups("guaranteeBankCode");

	if (
		taxSubstituteBankOptions.length === 0 &&
		guaranteeBankOptions.length === 0
	) {
		return lookups;
	}

	return {
		...lookups,
		fieldOptions: {
			...lookups.fieldOptions,
			taxSubstituteBankCode: mergeCatalogFieldLookups(
				lookups.fieldOptions.taxSubstituteBankCode,
				taxSubstituteBankOptions,
			),
			guaranteeBankCode: mergeCatalogFieldLookups(
				lookups.fieldOptions.guaranteeBankCode,
				guaranteeBankOptions,
			),
		},
	};
}

function mergePermitListByPermitNo<
	T extends DatabasePermitLookup | DatabaseImportLicenseLookup,
>(primary: T[] | undefined, fallback: T[] | undefined): T[] {
	const merged = new Map<string, T>();
	for (const row of primary ?? []) {
		const key = `${row.permitTypeCode ?? "NO_TYPE"}::${row.permitNo}`;
		merged.set(key, row);
	}
	for (const row of fallback ?? []) {
		const key = `${row.permitTypeCode ?? "NO_TYPE"}::${row.permitNo}`;
		if (!merged.has(key)) {
			merged.set(key, row);
		}
	}
	return [...merged.values()];
}

/**
 * The active `app_cds_lookups_latest` snapshot is `app-db-export`, which only ships
 * fieldOptions + customsWarehouses — `permitTypes` / `importLicenses` / `permits`
 * stay empty there, so the import-license dialog is empty. Enrich them by merging:
 *
 * 1. The latest `han2024_import_tables_*` HAN sync snapshot (if any),
 * 2. `permit_code_master.csv` (legacy CSV master),
 * 3. `cds_permit_type_codes.json` (optional manual export from app),
 *    and `cds_permit_codes.json` (from `npm run sync:permit-catalog` when MSSQL reachable).
 * 4. Embedded ECUS legal-document catalog for any still-missing permit type
 *    codes (many Ma_Loai_GP-class codes overlap).
 *
 * No source ever overwrites entries that already exist in the primary snapshot.
 */
function toEmbeddedEcusPermitTypeLookups(): DatabasePermitTypeLookup[] {
	return ECUS_LEGAL_DOCUMENT_OPTIONS.map((option) => ({
		code: option.value,
		name: option.documentNumber || option.label,
	}));
}

function withPermitCatalogFallback(
	lookups: CdsDatabaseLookups,
): CdsDatabaseLookups {
	const hanSync = readHanSyncSnapshot();
	const csvPermitTypes = toPermitTypeLookups();
	const jsonPermitTypes = toPermitTypeJsonLookups();
	const jsonPermitCodes = toPermitCodeJsonLookups();

	const permitTypeMap = new Map<string, DatabasePermitTypeLookup>();
	for (const row of lookups.permitTypes ?? []) {
		permitTypeMap.set(row.code, row);
	}
	for (const row of [
		...(hanSync?.permitTypes ?? []),
		...csvPermitTypes,
		...jsonPermitTypes,
		...jsonPermitCodes.permitTypes,
	]) {
		if (!permitTypeMap.has(row.code)) {
			permitTypeMap.set(row.code, row);
		}
	}

	for (const row of toEmbeddedEcusPermitTypeLookups()) {
		if (!permitTypeMap.has(row.code)) {
			permitTypeMap.set(row.code, row);
		}
	}

	let importLicenses = mergePermitListByPermitNo(
		lookups.importLicenses,
		hanSync?.importLicenses,
	);
	importLicenses = mergePermitListByPermitNo(
		importLicenses,
		jsonPermitCodes.importLicenses,
	);

	let permits = mergePermitListByPermitNo(lookups.permits, hanSync?.permits);
	permits = mergePermitListByPermitNo(permits, jsonPermitCodes.permits);

	return {
		...lookups,
		permitTypes: [...permitTypeMap.values()].sort((left, right) =>
			left.code.localeCompare(right.code, "en", { numeric: true }),
		),
		importLicenses,
		permits,
	};
}

function withTruckLoadingCodeFallback(
	lookups: CdsDatabaseLookups,
): CdsDatabaseLookups {
	const truckLoadingOptions = toTruckLoadingCodeLookups();
	if (truckLoadingOptions.length === 0) {
		return lookups;
	}

	return {
		...lookups,
		fieldOptions: {
			...lookups.fieldOptions,
			truckLoadingLocationCode: mergeTruckLoadingCodeLookups(
				lookups.fieldOptions.truckLoadingLocationCode,
				truckLoadingOptions,
			),
		},
	};
}

const FIELD_OPTION_MAPPINGS: Array<{
	field: CdsDatabaseFieldOptionKey;
	source: "header" | "vnaccs" | "vnaccs2";
	column: string;
}> = [
	{
		field: "customsCode",
		source: "header",
		column: "MA_HQ",
	},
	{
		field: "exportCountryCode",
		source: "header",
		column: "NUOC_XK",
	},
	{
		field: "invoiceFormClassificationCode",
		source: "header",
		column: "MA_HDTM",
	},
	{
		field: "invoiceClassificationCode",
		source: "header",
		column: "MA_PL_GIA_HDTM",
	},
	{
		field: "paymentMethod",
		source: "header",
		column: "MA_PTTT",
	},
	{
		field: "invoicePriceCondition",
		source: "header",
		column: "MA_GH",
	},
	{
		field: "invoiceCurrency",
		source: "header",
		column: "MA_NT",
	},
	{
		field: "taxableValueCurrencyCode",
		source: "header",
		column: "MA_NT_TGTT",
	},
	{
		field: "taxPaymentDeadlineCode",
		source: "header",
		column: "MA_THOI_HAN_NOP_THUE",
	},
	{
		field: "packageType",
		source: "header",
		column: "DVT_KIEN",
	},
	{
		field: "weightUnit",
		source: "header",
		column: "DVT_TR_LUONG",
	},
	{
		field: "transportFeeClassificationCode",
		source: "header",
		column: "MA_PHI_VC",
	},
	{
		field: "transportFeeCurrencyCode",
		source: "header",
		column: "MA_NT_PHI_VC",
	},
	{
		field: "insuranceFeeClassificationCode",
		source: "header",
		column: "MA_PHI_BH",
	},
	{
		field: "insuranceFeeCurrencyCode",
		source: "header",
		column: "MA_NT_PHI_BH",
	},
	{
		field: "guaranteeBankCode",
		source: "header",
		column: "DAM_BAO_MA_NG_HANG",
	},
	{
		field: "valuationDeclarationTypeCode",
		source: "vnaccs",
		column: "MA_KHAI_TRGIA",
	},
	{
		field: "taxPayer",
		source: "vnaccs",
		column: "MA_NGUOI_NOP_THUE",
	},
	{
		field: "releaseBeforePermitCode",
		source: "vnaccs",
		column: "MA_LY_DO_BP",
	},
	{
		field: "cargoClassificationCode",
		source: "vnaccs2",
		column: "MA_PHAN_LOAI_HH",
	},
	{
		field: "personOrganizationClassification",
		source: "vnaccs2",
		column: "CANHAN_TOCHUC",
	},
	{
		field: "transportMethodCode",
		source: "vnaccs2",
		column: "MA_HIEU_PTVC",
	},
	{
		field: "taxSubstituteBankCode",
		source: "vnaccs2",
		column: "BL_THUE_MA_NG_HANG",
	},
];

function readDirectionalDeclarationRows(
	source: "header" | "vnaccs" | "vnaccs2",
) {
	return {
		import: readLatestDeclarationExportRows(
			source === "header"
				? "dtokhaimd_header_import.csv"
				: source === "vnaccs"
					? "dtokhaimd_vnaccs_import.csv"
					: "dtokhaimd_vnaccs2_import.csv",
		),
		export: readLatestDeclarationExportRows(
			source === "header"
				? "dtokhaimd_header_export.csv"
				: source === "vnaccs"
					? "dtokhaimd_vnaccs_export.csv"
					: "dtokhaimd_vnaccs2_export.csv",
		),
	} as const;
}

function toFieldOptionLookups(): Partial<
	Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
> {
	const fieldOptions: Partial<
		Record<CdsDatabaseFieldOptionKey, DatabaseFieldOptionLookup[]>
	> = {};
	const cache = {
		header: readDirectionalDeclarationRows("header"),
		vnaccs: readDirectionalDeclarationRows("vnaccs"),
		vnaccs2: readDirectionalDeclarationRows("vnaccs2"),
	};

	for (const mapping of FIELD_OPTION_MAPPINGS) {
		const counts = new Map<string, DatabaseFieldOptionLookup>();
		const directionalRows = cache[mapping.source];

		(
			[
				["import", directionalRows.import],
				["export", directionalRows.export],
			] as const
		).forEach(([direction, rows]) => {
			rows.forEach((row) => {
				const rawValue =
					mapping.field === "exportCountryCode" && direction === "export"
						? normalizeText(row.NUOC_NK ?? row[mapping.column])
						: mapping.field === "valuationDeclarationTypeCode" &&
								direction === "export"
							? normalizeText(row.MA_PL_NOP_THUE)
							: normalizeText(row[mapping.column]);
				if (!rawValue) {
					return;
				}

				const value = rawValue.toUpperCase();
				if (!isAllowedVnaccsStandardFieldValue(mapping.field, value)) {
					return;
				}

				const key = `${direction}::${value}`;
				const existing = counts.get(key);

				if (existing) {
					existing.count += 1;
					return;
				}

				counts.set(key, {
					field: mapping.field,
					value,
					count: 1,
					direction,
					source: mapping.source === "header" ? "header" : "vnaccs",
				});
			});
		});

		fieldOptions[mapping.field] = [...counts.values()].sort((left, right) => {
			if (right.count !== left.count) {
				return right.count - left.count;
			}

			if (left.direction !== right.direction) {
				return left.direction.localeCompare(right.direction, "en");
			}

			return left.value.localeCompare(right.value, "en", { numeric: true });
		});
	}

	return fieldOptions;
}

export function getCdsDatabaseLookups(): CdsDatabaseLookups {
	const snapshotLookups = readLookupSnapshot();
	if (snapshotLookups) {
		return withPermitCatalogFallback(
			withTaxSubstituteBankFieldMerge(
				withBankCodeFallback(withTruckLoadingCodeFallback(snapshotLookups)),
			),
		);
	}

	return withPermitCatalogFallback(
		withTaxSubstituteBankFieldMerge(
			withBankCodeFallback(
				withTruckLoadingCodeFallback({
					operationCodes: toOperationCodeLookups(),
					importLicenses: toImportLicenseLookups(),
					permits: toGeneralPermitLookups(),
					permitTypes: toPermitTypeLookups(),
					processingDepartments: [],
					fieldOptions: toFieldOptionLookups(),
					electronicAttachments: [],
				}),
			),
		),
	);
}
