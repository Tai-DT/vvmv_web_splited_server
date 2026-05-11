/**
 * Materialize admin `field_options` rows into `cds_field_option_lookup` with `source = 'app'`,
 * matching the merge rules used by `/api/followup/cds-lookups` (`loadAppFieldOptions`).
 *
 * Does not pull ERP vehicles or `customs_warehouses` (those are merged at runtime in the API).
 * Extend this script to upsert those codes if offline catalogs need them—similarly, historical
 * values from `follow_up_cds_info` / submission logs could be aggregated into `app_saved` rows.
 *
 * Usage (from `vvmv-frontend`, DATABASE_URL required):
 *   pnpm cds:sync-app-lookups -- --dry-run
 *   pnpm cds:sync-app-lookups
 */
import {
	APP_FIELD_OPTION_FIELD_NAMES,
	CDS_HARDCODED_FIELD_OPTION_FIELDS,
} from "@/app/(home)/internal/followup/_components/panels/cds/cds-sets";
import type { FollowUpCdsInfoRow } from "@/app/(home)/internal/followup/types";
import type { DatabaseFieldOptionLookup } from "@/lib/followup/cds-database-lookups";
import {
	isAllowedVnaccsStandardFieldValue,
	isVnaccsStandardField,
} from "@/lib/followup/cds-vnaccs-standard-rules";
import { toAppLookupOptionsFromCodeNameRows } from "@/lib/followup/cds-web-field-options";

const APP_DYNAMIC_FIELD_OPTION_FIELD_NAMES =
	APP_FIELD_OPTION_FIELD_NAMES.filter(
		(fieldName) => !CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldName),
	);

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

async function buildAppFieldOptionLookups(): Promise<DatabaseFieldOptionLookup[]> {
	const { prismaRPA } = await import("@/lib/db");

	const rows = await prismaRPA.fieldOption.findMany({
		where: {
			fieldName: { in: [...APP_DYNAMIC_FIELD_OPTION_FIELD_NAMES] },
			isActive: true,
		},
		orderBy: [
			{ fieldName: "asc" },
			{ order: "asc" },
			{ code: "asc" },
			{ name: "asc" },
		],
		select: {
			fieldName: true,
			code: true,
			name: true,
		},
	});

	const groupedRows = new Map<
		Extract<keyof FollowUpCdsInfoRow, string>,
		Array<{ code: string | null | undefined; name: string | null | undefined }>
	>();

	for (const row of rows) {
		const fieldName = row.fieldName.trim();
		if (!fieldName) {
			continue;
		}

		const fieldKey = fieldName as Extract<keyof FollowUpCdsInfoRow, string>;
		if (CDS_HARDCODED_FIELD_OPTION_FIELDS.has(fieldKey)) {
			continue;
		}

		if (
			isVnaccsStandardField(fieldKey) &&
			!isAllowedVnaccsStandardFieldValue(fieldKey, row.code ?? "")
		) {
			continue;
		}

		const current = groupedRows.get(fieldKey) ?? [];
		current.push({
			code: row.code,
			name: row.name,
		});
		groupedRows.set(fieldKey, current);
	}

	const result: DatabaseFieldOptionLookup[] = [];

	for (const [fieldKey, groupedFieldRows] of groupedRows.entries()) {
		result.push(
			...toAppLookupOptionsFromCodeNameRows(fieldKey, groupedFieldRows),
		);
	}

	return result;
}

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error("DATABASE_URL must be set in the environment.");
		process.exit(1);
	}

	let disconnected = false;
	const disconnect = async () => {
		if (disconnected) {
			return;
		}
		disconnected = true;
		const { disconnectRPA } = await import("@/lib/db");
		await disconnectRPA();
	};

	try {
		const lookupRows = await buildAppFieldOptionLookups();

		console.log(
			`sync_app_field_options: ${lookupRows.length} lookup row(s) from FieldOption (dynamic fields, all sites)`,
		);

		if (dryRun) {
			const preview = lookupRows.slice(0, 5);
			if (preview.length > 0) {
				console.log("preview (first 5):", JSON.stringify(preview, null, 2));
			}
			console.log("[dry-run] No writes to cds_field_option_lookup.");
			return;
		}

		const { prismaRPA } = await import("@/lib/db");

		let upserted = 0;
		for (const row of lookupRows) {
			await prismaRPA.cdsFieldOptionLookup.upsert({
				where: {
					field_value_direction_source: {
						field: row.field,
						value: row.value,
						direction: row.direction,
						source: "app",
					},
				},
				create: {
					field: row.field,
					value: row.value,
					label: row.label,
					address: null,
					count: row.count,
					direction: row.direction,
					source: "app",
				},
				update: {
					label: row.label,
					count: row.count,
				},
			});
			upserted += 1;
		}

		console.log(
			`Upserted ${upserted} row(s) into cds_field_option_lookup (source=app).`,
		);
	} finally {
		await disconnect();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
