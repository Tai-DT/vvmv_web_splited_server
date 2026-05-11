import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(backendRoot, "..");

dotenv.config({ path: path.join(backendRoot, ".env") });

const auditOnly = process.argv.includes("--audit-only");
const snapshotArg = process.argv.find((arg) => arg.endsWith(".json"));
const snapshotPath = snapshotArg
  ? path.resolve(snapshotArg)
  : path.join(
      workspaceRoot,
      "ai-vvmv/vvmv-operational-bundle/app-reference-data/2026-05-09T03-25-20-552Z/database-exports/app_cds_lookups_latest/cds_database_lookups.json",
    );

const cdsLookupMigrationPath = path.join(
  backendRoot,
  "prisma/migrations/2026-05-10_12-00-00_add_cds_lookup_tables.sql",
);

const appReferenceRoot = path.join(
  workspaceRoot,
  "ai-vvmv/vvmv-operational-bundle/app-reference-data/2026-05-09T03-25-20-552Z/postgres-reference",
);
const rpaFullRoot = path.join(
  workspaceRoot,
  "ai-vvmv/vvmv-dumps/rpa-postgres-full",
);

const appReferenceTables = [
  ["field_options", path.join(appReferenceRoot, "postgres_field_options.jsonl")],
  ["shipping_lines", path.join(appReferenceRoot, "postgres_shipping_lines.jsonl")],
  ["foreign_ports", path.join(appReferenceRoot, "postgres_foreign_ports.jsonl")],
  ["ops", path.join(appReferenceRoot, "postgres_ops.jsonl")],
  ["vendors", path.join(appReferenceRoot, "postgres_vendors.jsonl")],
  [
    "pick_or_lift_places",
    path.join(appReferenceRoot, "postgres_pick_or_lift_places.jsonl"),
  ],
  [
    "container_size_configs",
    path.join(appReferenceRoot, "postgres_container_size_configs.jsonl"),
  ],
  [
    "customs_warehouses",
    path.join(appReferenceRoot, "postgres_customs_warehouses.jsonl"),
  ],
  ["warehouse_config", path.join(appReferenceRoot, "postgres_warehouse_config.jsonl")],
  [
    "trucking_numbers",
    path.join(appReferenceRoot, "postgres_trucking_numbers.jsonl"),
  ],
  ["vendor_fee_type", path.join(appReferenceRoot, "postgres_vendor_fee_type.jsonl")],
  ["company_color", path.join(appReferenceRoot, "postgres_company_color.jsonl")],
  ["field_template", path.join(appReferenceRoot, "postgres_field_template.jsonl")],
  ["department", path.join(appReferenceRoot, "postgres_department.jsonl")],
  ["team", path.join(appReferenceRoot, "postgres_team.jsonl")],
  ["team_leader", path.join(appReferenceRoot, "postgres_team_leader.jsonl")],
  ["team_member", path.join(appReferenceRoot, "postgres_team_member.jsonl")],
  ["user_department", path.join(appReferenceRoot, "postgres_user_department.jsonl")],
  ["user", path.join(rpaFullRoot, "user.jsonl")],
  ["partners_master_data", path.join(rpaFullRoot, "partners_master_data.jsonl")],
];

const erpSnapshotTables = [
  "Airports",
  "UnitContents",
  "VehicleList",
  "FormControlList",
  "Partners",
];

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const text = (value) => (value == null ? null : String(value));
const intValue = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function countJsonlRows(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const textValue = fs.readFileSync(filePath, "utf8").trim();
  return textValue ? textValue.split("\n").length : 0;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function tableCount(client, tableName) {
  if (!(await tableExists(client, tableName))) return null;
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function insertRows(client, table, columns, rows, conflictSql, batchSize = 1000) {
  if (!rows.length) return 0;
  let total = 0;
  for (const part of chunk(rows, batchSize)) {
    const values = [];
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

async function ensureCdsLookupTables(client) {
  const sql = fs.readFileSync(cdsLookupMigrationPath, "utf8");
  await client.query(sql);
}

async function importCdsLookups(client) {
  const raw = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const data = raw.data ?? raw;

  await client.query("BEGIN");
  try {
    await client.query(
      "UPDATE cds_lookup_snapshot SET is_active = false WHERE is_active = true",
    );
    await client.query(
      "INSERT INTO cds_lookup_snapshot (source, generated_at, is_active) VALUES ($1, COALESCE($2::timestamptz, now()), true)",
      [raw.source ?? path.basename(snapshotPath), raw.generatedAt ?? null],
    );

    const operationCodes = (data.operationCodes ?? [])
      .map((row) => ({
        code: text(row.code),
        name: text(row.name) ?? "",
        direction: text(row.direction) ?? "unknown",
      }))
      .filter((row) => row.code);
    await insertRows(
      client,
      "cds_operation_code_lookup",
      ["code", "name", "direction"],
      operationCodes,
      "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, direction = EXCLUDED.direction",
    );

    const permitRows = [
      ...(data.importLicenses ?? []).map((row) => ({
        ...row,
        kind: "import_license",
      })),
      ...(data.permits ?? []).map((row) => ({ ...row, kind: "permit" })),
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

    const permitTypes = (data.permitTypes ?? [])
      .map((row) => ({
        code: text(row.code),
        name: text(row.name) ?? "",
      }))
      .filter((row) => row.code);
    await insertRows(
      client,
      "cds_permit_type_lookup",
      ["code", "name"],
      permitTypes,
      "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name",
    );

    const processingDepartments = (data.processingDepartments ?? [])
      .map((row) => ({
        code: text(row.code),
        customs_code: text(row.customsCode),
        name: text(row.name) ?? "",
        operation_codes: JSON.stringify(row.operationCodes ?? []),
        allow_import: Boolean(row.allowImport),
        allow_export: Boolean(row.allowExport),
      }))
      .filter((row) => row.code && row.customs_code);
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
      processingDepartments,
      `ON CONFLICT (code, customs_code) DO UPDATE SET
        name = EXCLUDED.name,
        operation_codes = EXCLUDED.operation_codes::jsonb,
        allow_import = EXCLUDED.allow_import,
        allow_export = EXCLUDED.allow_export`,
    );

    const fieldRows = [];
    for (const [field, options] of Object.entries(data.fieldOptions ?? {})) {
      for (const row of options ?? []) {
        const value = text(row.value)?.trim();
        if (!value) continue;
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

    const electronicAttachments = (data.electronicAttachments ?? [])
      .map((row) => ({
        attachment_type_code: text(row.attachmentTypeCode),
        attachment_number: text(row.attachmentNumber),
        attachment_description: text(row.attachmentDescription),
        count: intValue(row.count),
      }))
      .filter((row) => row.attachment_type_code);
    await insertRows(
      client,
      "cds_electronic_attachment_lookup",
      ["attachment_type_code", "attachment_number", "attachment_description", "count"],
      electronicAttachments,
      `ON CONFLICT (attachment_type_code, attachment_number) DO UPDATE SET
        attachment_description = EXCLUDED.attachment_description,
        count = EXCLUDED.count`,
    );

    await client.query("COMMIT");
    return {
      operationCodes: operationCodes.length,
      permits: permitRows.length,
      permitTypes: permitTypes.length,
      processingDepartments: processingDepartments.length,
      fieldOptions: fieldRows.length,
      electronicAttachments: electronicAttachments.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function auditAppReferences(client) {
  const rows = [];
  for (const [table, filePath] of appReferenceTables) {
    const expected = countJsonlRows(filePath);
    const actual = await tableCount(client, table);
    rows.push({
      table,
      expected,
      actual,
      status: actual == null ? "missing-table" : expected === actual ? "ok" : "mismatch",
    });
  }
  return rows;
}

function hasLikelyErpSnapshot(tableName) {
  const roots = [
    path.join(workspaceRoot, "ai-vvmv/vvmv-dumps"),
    path.join(workspaceRoot, "ai-vvmv/vvmv-operational-bundle"),
    path.join(workspaceRoot, "ai-vvmv/vvmv-ecus-erp-full"),
  ];
  const exact = new RegExp(`^${tableName}\\.(jsonl?|csv|xlsx?)$`, "i");
  const prefix = new RegExp(`^${tableName}[_-]`, "i");
  const stack = roots.filter((root) => fs.existsSync(root));
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      if (["node_modules", ".venv", "venv"].includes(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (exact.test(entry.name) || prefix.test(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

async function auditCdsLookups(client) {
  const tables = [
    "cds_operation_code_lookup",
    "cds_permit_lookup",
    "cds_permit_type_lookup",
    "cds_processing_department_lookup",
    "cds_field_option_lookup",
    "cds_electronic_attachment_lookup",
  ];
  const rows = {};
  for (const table of tables) {
    rows[table] = await tableCount(client, table);
  }
  return rows;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Set it in vvmv-backend/.env.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log("Option data audit");
    console.log(`snapshot=${snapshotPath}`);

    if (!auditOnly) {
      await ensureCdsLookupTables(client);
      const imported = await importCdsLookups(client);
      console.log("imported_cds=" + JSON.stringify(imported));
    }

    const appRows = await auditAppReferences(client);
    const mismatches = appRows.filter((row) => row.status !== "ok");
    console.log("app_reference=" + JSON.stringify({
      ok: appRows.length - mismatches.length,
      mismatches,
    }));

    const cdsRows = await auditCdsLookups(client);
    console.log("cds_lookup_counts=" + JSON.stringify(cdsRows));

    const missingErpSnapshots = erpSnapshotTables.filter(
      (table) => !hasLikelyErpSnapshot(table),
    );
    console.log(
      "missing_erp_snapshots=" + JSON.stringify(missingErpSnapshots),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
