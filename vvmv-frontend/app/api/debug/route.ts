import sql from "mssql";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";
import { resolveHanConnectionForTaxCode } from "@/lib/followup/han-connection";
import type { Site } from "@/prisma/client";

export const runtime = "nodejs";

function parseSite(value: string | null): Site | null {
	return value === "SGN" || value === "HAN" || value === "DAD" ? value : null;
}

export async function GET(request: Request) {
	const session = await auth.api.getSession({
		headers: new Headers(request.headers),
	});

	if (!session?.user || session.user.role !== "SUPERADMIN") {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const url = new URL(request.url);
	const taxCode = url.searchParams.get("taxCode");
	if (!taxCode?.trim()) {
		return NextResponse.json(
			{ error: "Missing taxCode to resolve partners_master_data.ddInfo" },
			{ status: 400 },
		);
	}

	const hanConnection = await resolveHanConnectionForTaxCode({
		taxCode,
		site: parseSite(url.searchParams.get("site")),
	});
	const sqlConfig = parseMssqlConnectionString(hanConnection.connectionString, {
		appName: "vvmv-debug-han-schema",
	});
	if (!sqlConfig) {
		return NextResponse.json(
			{ error: "Missing or invalid partners_master_data.ddInfo" },
			{ status: 500 },
		);
	}

	const pool = new sql.ConnectionPool(sqlConfig);
	await pool.connect();
	try {
		const result = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN ('DTOKHAIMD', 'DTOKHAIMD_VNACCS', 'DTOKHAIMD_VNACCS2')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

		return NextResponse.json(result.recordset);
	} finally {
		await pool.close();
	}
}
