import sql from "mssql";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { parseMssqlConnectionString } from "@/lib/db/mssql-connection-string";

type Site = "SGN" | "HAN" | "DAD";

function clean(value: unknown) {
	const text = String(value ?? "").trim();
	return text || null;
}

function parseBoolean(value: string | null) {
	return ["true", "1", "yes"].includes(String(value ?? "").toLowerCase());
}

function publicConnectionInfo(ddInfo: string | null | undefined) {
	const config = parseMssqlConnectionString(ddInfo, {
		appName: "vvmv-partner-connection-status",
		connectionTimeout: 5000,
		requestTimeout: 5000,
	});

	if (!config) {
		return {
			parseable: false,
			server: null,
			port: null,
			database: null,
			hasUser: false,
			hasPassword: false,
		};
	}

	return {
		parseable: true,
		server: clean(config.server),
		port: typeof config.port === "number" ? config.port : null,
		database: clean(config.database),
		hasUser: Boolean(clean(config.user)),
		hasPassword: Boolean(clean(config.password)),
		encrypt: Boolean(config.options?.encrypt),
		trustServerCertificate: Boolean(config.options?.trustServerCertificate),
	};
}

export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: await headers(),
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const userRole = session.user.role;
		const isAdmin = userRole === "ADMIN";
		const isSuperAdmin = userRole === "SUPERADMIN";
		const isManager = userRole === "MANAGER";

		if (!isAdmin && !isSuperAdmin && !isManager) {
			return NextResponse.json(
				{ error: "You don't have permission to inspect partner connections" },
				{ status: 403 },
			);
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		const shouldTestConnection = parseBoolean(searchParams.get("test"));

		if (!id) {
			return NextResponse.json(
				{ error: "Partner ID is required" },
				{ status: 400 },
			);
		}

		const userSite = (session.user as { site?: Site | null }).site;
		const partner = await prismaRPA.partnersMasterData.findUnique({
			where: { id },
			select: {
				id: true,
				taxCode: true,
				site: true,
				enableCDS: true,
				ddInfo: true,
			},
		});

		if (!partner) {
			return NextResponse.json({ error: "Partner not found" }, { status: 404 });
		}

		if (!isSuperAdmin && partner.site !== userSite) {
			return NextResponse.json(
				{ error: "You can only inspect partners in your site" },
				{ status: 403 },
			);
		}

		const info = publicConnectionInfo(partner.ddInfo);
		const response: Record<string, unknown> = {
			partnerId: partner.id,
			taxCode: partner.taxCode,
			site: partner.site,
			enableCDS: partner.enableCDS,
			source: "partners_master_data.dd_info",
			...info,
			tested: false,
			reachable: null,
			error: info.parseable
				? null
				: "dd_info không phải connection string SQL Server hợp lệ.",
		};

		if (shouldTestConnection && info.parseable) {
			let pool: sql.ConnectionPool | null = null;
			try {
				const config = parseMssqlConnectionString(partner.ddInfo, {
					appName: "vvmv-partner-connection-status",
					connectionTimeout: 5000,
					requestTimeout: 5000,
				});

				if (!config) {
					throw new Error("dd_info không hợp lệ.");
				}

				pool = await sql.connect(config);
				await pool.request().query("SELECT 1 AS ok");
				response.tested = true;
				response.reachable = true;
				response.error = null;
			} catch (error) {
				response.tested = true;
				response.reachable = false;
				response.error =
					error instanceof Error
						? error.message
						: "Không kết nối được CSDL khách hàng.";
			} finally {
				if (pool) {
					await pool.close().catch(() => undefined);
				}
			}
		}

		return NextResponse.json(response);
	} catch (error) {
		console.error("Partner connection status error:", error);
		return NextResponse.json(
			{
				error: "Internal Server Error",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
