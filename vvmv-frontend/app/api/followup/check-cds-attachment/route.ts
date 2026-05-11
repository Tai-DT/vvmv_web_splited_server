import * as sql from "mssql";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * Helper to parse DD Info connection string into MSSQL config
 */
const parseDDInfoToConfig = (str: string | null): sql.config | null => {
	if (!str) return null;

	const parts = str.split(";").reduce(
		(acc, part) => {
			const [key, ...val] = part.split("=");
			if (key && val.length > 0) acc[key.trim()] = val.join("=").trim();
			return acc;
		},
		{} as Record<string, string>,
	);

	const server = parts["Data Source"];
	const database = parts["Initial Catalog"];
	const user = parts["User ID"];
	const password = parts.Password;

	if (!server || !database || !user || !password) return null;

	return {
		server,
		database,
		user,
		password,
		options: {
			encrypt: parts.Encrypt?.toLowerCase() === "true",
			trustServerCertificate: true, // Often needed for local/dev servers
		},
		// Important for connecting to remote SQL servers
		connectionTimeout: 15000,
		requestTimeout: 15000,
	};
};

/**
 * POST /api/followup/check-cds-attachment
 * Checks CDS attachments in external MSSQL databases
 */
export async function POST(request: NextRequest) {
	console.log("DEBUG - Received POST request for Check CDS Attachment");
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { jobNumber } = body;
		console.log(`DEBUG - Checking CDS for Job: ${jobNumber}`);

		if (!jobNumber) {
			return NextResponse.json(
				{ message: "Job Number is required" },
				{ status: 400 },
			);
		}

		// 1. Get follow-up with its declarations
		console.log("DEBUG - Fetching followUp from Prisma...");
		const followUp = await prismaRPA.followUp.findFirst({
			where: { jobNumber, isDeleted: false },
			include: {
				declarations: true,
			},
		});

		if (!followUp || !followUp.declarations.length) {
			console.log("DEBUG - No followUp or declarations found.");
			return NextResponse.json(
				{
					message: "No declarations found for this job",
					success: false,
				},
				{ status: 404 },
			);
		}

		console.log(`DEBUG - Found ${followUp.declarations.length} declarations.`);
		const results = [];
		let updatedCount = 0;

		// Cache for connection pools to avoid reconnecting to the same server multiple times
		const pools: Record<string, sql.ConnectionPool> = {};

		// 2. Process each declaration
		for (const dec of followUp.declarations) {
			try {
				if (!dec.declarationNumber || !dec.mstClient) {
					results.push({
						declarationNumber: dec.declarationNumber || "N/A",
						status: "Skipped",
						message: "Missing Declaration Number or MST Client",
					});
					continue;
				}

				// 3. Find partner SQL info
				const partner = await prismaRPA.partnersMasterData.findFirst({
					where: { taxCode: dec.mstClient },
					select: { ddInfo: true },
				});

				if (!partner || !partner.ddInfo) {
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Error",
						message: `SQL Connection Info (DD Info) not found for MST: ${dec.mstClient}`,
					});
					continue;
				}

				const mssqlConfig = parseDDInfoToConfig(partner.ddInfo);
				if (!mssqlConfig) {
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Error",
						message: `Invalid SQL Connection string for MST: ${dec.mstClient}`,
					});
					continue;
				}

				// 4. Connect and Query
				try {
					// Use cached pool or create new one
					const poolKey = partner.ddInfo;
					if (!pools[poolKey]) {
						const newPool = new sql.ConnectionPool(mssqlConfig);
						pools[poolKey] = await newPool.connect();
						console.log("DEBUG - Pool connected successfully.");
					}
					const pool = pools[poolKey];

					// Clean declaration number to avoid conversion errors
					const cleanDecNumber =
						dec.declarationNumber?.replace(/\D/g, "") || "";

					// Query 1: Get attachDocuments
					console.log(
						`DEBUG - Running attachDocuments query for SOTK: ${cleanDecNumber}`,
					);
					const attachQuery = `
                        SELECT STUFF((
                            SELECT ', ' + LOAI_CT
                            FROM DCHUNGTU_BS 
                            WHERE SOTK = @cds
                            FOR XML PATH('')
                        ), 1, 2, '') AS DanhSachLoaiCT;
                    `;

					const attachResult = await pool
						.request()
						.input("cds", sql.VarChar, cleanDecNumber)
						.query(attachQuery);

					const attachDocuments =
						attachResult.recordset[0]?.DanhSachLoaiCT || null;

					// Query 2: Get firstCds
					console.log(
						`DEBUG - Running firstCds query for SOTK: ${cleanDecNumber}`,
					);
					const firstCdsQuery = `
                        SELECT TOP 1 SOTK_DAU_TIEN 
                        FROM DTOKHAIMD 
                        WHERE SOTK = @cds
                    `;

					const firstCdsResult = await pool
						.request()
						.input("cds", sql.VarChar, cleanDecNumber)
						.query(firstCdsQuery);

					const firstCds =
						firstCdsResult.recordset?.[0]?.SOTK_DAU_TIEN?.toString() || null;

					// Update database with both fields
					await prismaRPA.declaration.update({
						where: { id: dec.id },
						data: {
							attachDocuments,
							...(firstCds && { firstCds }),
						},
					});

					updatedCount++;
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Success",
						message: `Updated: attach=${attachDocuments || "None"}, firstCds=${firstCds || "None"}`,
						attachDocuments: attachDocuments || "None",
						firstCds: firstCds || "None",
					});
				} catch (sqlErr: any) {
					results.push({
						declarationNumber: dec.declarationNumber,
						status: "Error",
						message: `SQL Error: ${sqlErr.message}`,
					});
				}
			} catch (decErr: any) {
				results.push({
					declarationNumber: dec.declarationNumber || "Unknown",
					status: "Error",
					message: `Internal error: ${decErr.message}`,
				});
			}
		}

		// 5. Close all pools
		for (const key in pools) {
			try {
				await pools[key].close();
			} catch (closeErr) {
				console.error("Error closing pool:", closeErr);
			}
		}

		const responseData = {
			success: true,
			updatedCount,
			results,
			message: `Processed ${followUp.declarations.length} declarations. Updated ${updatedCount}.`,
		};

		return new NextResponse(
			JSON.stringify(responseData, (_, value) =>
				typeof value === "bigint" ? value.toString() : value,
			),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error: any) {
		if (error instanceof Error) {
			console.error("DEBUG - Error Message:", error.message);
			console.error("DEBUG - Error Stack:", error.stack);
		}
		return NextResponse.json(
			{
				message: "Internal Server Error",
				error: error.message,
				details: error instanceof Error ? error.stack : undefined,
			},
			{ status: 500 },
		);
	}
}
