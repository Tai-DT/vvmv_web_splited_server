/**
 * Populate Postgres CDS lookup tables from the same merged snapshot as the web app:
 * `database/exports/app_cds_lookups_latest/cds_database_lookups.json` plus fallbacks
 * (`cds_bank_codes.json`, `cds_truck_loading_codes.json`, permit JSON/CSV, etc.) via
 * `getCdsDatabaseLookups()` in `lib/followup/cds-database-lookups.ts`.
 *
 * Usage (from `vvmv-frontend`, DATABASE_URL set):
 *   pnpm cds:import-lookups
 *   pnpm cds:import-lookups -- --dry-run
 *
 * Requires migration `2026-05-10_12-00-00_add_cds_lookup_tables.sql` applied.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { CdsDatabaseLookups } from "@/lib/followup/cds-database-lookups";
import { getCdsDatabaseLookups } from "@/lib/followup/cds-database-lookups";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

function readSnapshotMeta(): { source: string; generatedAt: string | null } {
	const snapshotPath = path.join(
		root,
		"database/exports/app_cds_lookups_latest/cds_database_lookups.json",
	);
	try {
		const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
			source?: string;
			generatedAt?: string | null;
		};
		return {
			source: raw.source ?? "app_cds_lookups_latest/cds_database_lookups.json",
			generatedAt: raw.generatedAt ?? null,
		};
	} catch {
		return { source: "getCdsDatabaseLookups", generatedAt: null };
	}
}

const chunk = <T>(items: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
};

const text = (value: unknown) => (value == null ? null : String(value));
const intValue = (value: unknown) =>
	Number.isFinite(Number(value)) ? Number(value) : 0;

async function insertRows(
	client: pg.PoolClient,
	table: string,
	columns: string[],
	rows: Record<string, unknown>[],
	conflictSql: string,
	batchSize = 1000,
): Promise<number> {
	if (!rows.length) {
		return 0;
	}
	let total = 0;
	for (const part of chunk(rows, batchSize)) {
		const values: unknown[] = [];
		const placeholders = part.map((row, rowIndex) => {
			const cells = columns.map((column, colIndex) => {
				values.push(row[column]);
				return `$${rowIndex * columns.length + colIndex + 1}`;
			});
			return `(${cells.join(",")})`;
		});
		await client.query(
			`INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders.join(",")} ${conflictSql}`,
			values,
		);
		total += part.length;
	}
	return total;
}

function buildRows(data: CdsDatabaseLookups) {
	const permitRows = [
		...(data.importLicenses ?? []).map((row) => ({
			...row,
			kind: "import_license" as const,
		})),
		...(data.permits ?? []).map((row) => ({ ...row, kind: "permit" as const })),
	]
		.map((row) => ({
			id: `${row.kind}:${row.id}`,
			kind: row.kind,
			permit_type_code: text(row.permitTypeCode),
			permit_type_name: text(row.permitTypeName),
			permit_no: text(row.permitNo) ?? "",
			permit_issue_date: text(row.permitIssueDate),
			permit_expiry_date: text(row.permitExpiryDate),
			declaration_count:
				row.declarationCount == null ? null : Number(row.declarationCount),
			first_declaration_date: text(row.firstDeclarationDate),
			last_declaration_date: text(row.lastDeclarationDate),
			sample_declaration_no: text(row.sampleDeclarationNo),
			sample_customs_code: text(row.sampleCustomsCode),
			is_explicit_import_license: Boolean(row.isExplicitImportLicense),
		}))
		.filter((row) => row.permit_no);

	const fieldRows: Record<string, unknown>[] = [];
	for (const [field, options] of Object.entries(data.fieldOptions ?? {})) {
		for (const row of options ?? []) {
			const value = text(row.value)?.trim();
			if (!value) {
				continue;
			}
			fieldRows.push({
				field,
				value,
				label: text(row.label),
				address: text(row.address),
				count: intValue(row.count),
				direction: text(row.direction) ?? "unknown",
				source: text(row.source) ?? "snapshot",
			});
		}
	}

	return { permitRows, fieldRows };
}

async function main() {
	console.log(
		dryRun
			? "[dry-run] Computing merged CDS lookups (no database writes)…"
			: "Loading merged CDS lookups…",
	);

	const data = getCdsDatabaseLookups();
	const meta = readSnapshotMeta();
	const { permitRows, fieldRows } = buildRows(data);

	const stats = {
		operationCodes: data.operationCodes?.length ?? 0,
		permitTypes: data.permitTypes?.length ?? 0,
		processingDepartments: data.processingDepartments?.length ?? 0,
		electronicAttachments: data.electronicAttachments?.length ?? 0,
		importLicenses: data.importLicenses?.length ?? 0,
		permits: data.permits?.length ?? 0,
		permitRowsUpsert: permitRows.length,
		fieldOptionRows: fieldRows.length,
	};

	console.log("cds_lookup_import_counts=" + JSON.stringify(stats));
	console.log(
		`snapshot_meta=${JSON.stringify(meta)} (cds_lookup_snapshot row if not dry-run)`,
	);

	if (dryRun) {
		console.log("[dry-run] Done.");
		return;
	}

	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.error("DATABASE_URL is required (omit --dry-run only after setting it)");
		process.exit(1);
	}

	const pool = new Pool({ connectionString });
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		await client.query(
			"UPDATE cds_lookup_snapshot SET is_active = false WHERE is_active = true",
		);
		await client.query(
			"INSERT INTO cds_lookup_snapshot (source, generated_at, is_active) VALUES ($1, COALESCE($2::timestamptz, now()), true)",
			[
				`${meta.source} (merged:getCdsDatabaseLookups)`,
				meta.generatedAt,
			],
		);

		await insertRows(
			client,
			"cds_operation_code_lookup",
			["code", "name", "direction"],
			(data.operationCodes ?? []).map((row) => ({
				code: text(row.code),
				name: text(row.name) ?? "",
				direction: text(row.direction) ?? "unknown",
			})) as Record<string, unknown>[],
			"ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, direction = EXCLUDED.direction",
		);

		await insertRows(
			client,
			"cds_permit_lookup",
			[
				"id",
				"kind",
				"permit_type_code",
				"permit_type_name",
				"permit_no",
				"permit_issue_date",
				"permit_expiry_date",
				"declaration_count",
				"first_declaration_date",
				"last_declaration_date",
				"sample_declaration_no",
				"sample_customs_code",
				"is_explicit_import_license",
			],
			permitRows,
			`ON CONFLICT (id) DO UPDATE SET
      kind = EXCLUDED.kind,
      permit_type_code = EXCLUDED.permit_type_code,
      permit_type_name = EXCLUDED.permit_type_name,
      permit_no = EXCLUDED.permit_no,
      permit_issue_date = EXCLUDED.permit_issue_date,
      permit_expiry_date = EXCLUDED.permit_expiry_date,
      declaration_count = EXCLUDED.declaration_count,
      first_declaration_date = EXCLUDED.first_declaration_date,
      last_declaration_date = EXCLUDED.last_declaration_date,
      sample_declaration_no = EXCLUDED.sample_declaration_no,
      sample_customs_code = EXCLUDED.sample_customs_code,
      is_explicit_import_license = EXCLUDED.is_explicit_import_license`,
		);

		await insertRows(
			client,
			"cds_permit_type_lookup",
			["code", "name"],
			(data.permitTypes ?? []).map((row) => ({
				code: text(row.code),
				name: text(row.name) ?? "",
			})) as Record<string, unknown>[],
			"ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name",
		);

		await insertRows(
			client,
			"cds_processing_department_lookup",
			[
				"code",
				"customs_code",
				"name",
				"operation_codes",
				"allow_import",
				"allow_export",
			],
			(data.processingDepartments ?? []).map((row) => ({
				code: text(row.code),
				customs_code: text(row.customsCode),
				name: text(row.name) ?? "",
				operation_codes: JSON.stringify(row.operationCodes ?? []),
				allow_import: Boolean(row.allowImport),
				allow_export: Boolean(row.allowExport),
			})) as Record<string, unknown>[],
			`ON CONFLICT (code, customs_code) DO UPDATE SET
      name = EXCLUDED.name,
      operation_codes = EXCLUDED.operation_codes::jsonb,
      allow_import = EXCLUDED.allow_import,
      allow_export = EXCLUDED.allow_export`,
		);

		await insertRows(
			client,
			"cds_field_option_lookup",
			["field", "value", "label", "address", "count", "direction", "source"],
			fieldRows,
			`ON CONFLICT (field, value, direction, source) DO UPDATE SET
      label = EXCLUDED.label,
      address = EXCLUDED.address,
      count = EXCLUDED.count`,
			500,
		);

		await insertRows(
			client,
			"cds_electronic_attachment_lookup",
			[
				"attachment_type_code",
				"attachment_number",
				"attachment_description",
				"count",
			],
			(data.electronicAttachments ?? []).map((row) => ({
				attachment_type_code: text(row.attachmentTypeCode),
				attachment_number: text(row.attachmentNumber),
				attachment_description: text(row.attachmentDescription),
				count: intValue(row.count),
			})) as Record<string, unknown>[],
			`ON CONFLICT (attachment_type_code, attachment_number) DO UPDATE SET
      attachment_description = EXCLUDED.attachment_description,
      count = EXCLUDED.count`,
		);

		await client.query("COMMIT");
		console.log("Imported CDS lookups (merged getCdsDatabaseLookups).");
	} catch (error) {
		await client.query("ROLLBACK");
		console.error(error);
		process.exitCode = 1;
	} finally {
		client.release();
		await pool.end();
	}
}

main();
