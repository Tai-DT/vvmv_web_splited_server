import fs from "node:fs";
import path from "node:path";

/**
 * `database/exports` holds the generated CDS catalogs (see
 * `scripts/import-cds-lookups.ts`). It is build output rather than source, so a
 * clean clone has none of it and the readers in `lib/followup/*` degrade to
 * empty catalogs.
 *
 * Use this to gate tests that assert on real catalog rows — they skip where the
 * dataset is absent and still run in full once it has been generated locally.
 */
export function hasCdsExportFile(...segments: string[]) {
	return fs.existsSync(
		path.join(process.cwd(), "database", "exports", ...segments),
	);
}
