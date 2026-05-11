import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";

const PARTNERS_QUERY = `
SELECT Taxcode, COALESCE(PartnerName, PartnerName2, PartnerName3) AS Name
FROM Partners
WHERE Denied = 0 AND Taxcode IS NOT NULL AND Taxcode <> ''
`;

type PartnerResult = {
	Taxcode: string;
	Name: string;
};

function normalizeTaxcode(
	row: PartnerResult | Record<string, unknown>,
): string {
	return String((row as PartnerResult).Taxcode ?? "").trim();
}

function normalizeDisplayName(
	row: PartnerResult | Record<string, unknown>,
	taxcode: string,
): string {
	const name = (row as PartnerResult).Name;
	const trimmed =
		typeof name === "string" ? name.trim() : String(name ?? "").trim();
	return trimmed || taxcode;
}

/** ERP rows may use numeric Taxcode; avoid calling string methods on non-strings. */
function rowsToPartners(
	recordset: Array<PartnerResult & { domain?: string }>,
): Array<{ id: string; name: string; domain?: string }> {
	const seen = new Set<string>();
	const partners: Array<{ id: string; name: string; domain?: string }> = [];
	for (const row of recordset) {
		const id = normalizeTaxcode(row);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		partners.push({
			id,
			name: normalizeDisplayName(row, id),
			domain: row.domain,
		});
	}
	return partners;
}

export async function GET(_request: NextRequest) {
	const dev = process.env.NODE_ENV === "development";

	try {
		const session = await auth.api.getSession({
			headers: _request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		// Fetch user's site from database
		const user = await prismaRPA.user.findUnique({
			where: { id: session.user.id },
			select: { site: true },
		});
		// Check if user is ADMIN or SUPERADMIN
		const isAdmin = session.user.role === "ADMIN";
		const isSuperAdmin = session.user.role === "SUPERADMIN";

		const fetchFromAll = isAdmin || isSuperAdmin;
		const warnings: string[] = [];

		let mergedRows: Array<PartnerResult & { domain?: string }> = [];

		if (fetchFromAll) {
			const [hcmSettled, hanSettled] = await Promise.allSettled([
				queryERPHCM<PartnerResult>(PARTNERS_QUERY),
				queryERPHAN<PartnerResult>(PARTNERS_QUERY),
			]);

			if (hcmSettled.status === "fulfilled") {
				mergedRows.push(
					...(hcmSettled.value.recordset ?? []).map((row) => ({
						...row,
						domain: "SGN" as const,
					})),
				);
			} else {
				const msg =
					hcmSettled.reason instanceof Error
						? hcmSettled.reason.message
						: String(hcmSettled.reason);
				console.error("Partners ERP HCM query failed:", msg);
				if (dev) warnings.push(`ERP HCM (SGN) unavailable: ${msg}`);
			}

			if (hanSettled.status === "fulfilled") {
				mergedRows.push(
					...(hanSettled.value.recordset ?? []).map((row) => ({
						...row,
						domain: "HAN" as const,
					})),
				);
			} else {
				const msg =
					hanSettled.reason instanceof Error
						? hanSettled.reason.message
						: String(hanSettled.reason);
				console.error("Partners ERP HN query failed:", msg);
				if (dev) warnings.push(`ERP HN unavailable: ${msg}`);
			}
		} else {
			if (!user?.site) {
				return NextResponse.json(
					{ message: "User site not configured" },
					{ status: 400 },
				);
			}

			if (user.site === "SGN") {
				const [settled] = await Promise.allSettled([
					queryERPHCM<PartnerResult>(PARTNERS_QUERY),
				]);
				if (settled.status === "fulfilled") {
					mergedRows = (settled.value.recordset ?? []).map((row) => ({
						...row,
						domain: "SGN" as const,
					}));
				} else {
					const msg =
						settled.reason instanceof Error
							? settled.reason.message
							: String(settled.reason);
					console.error(`Partners ERP query failed for site SGN:`, msg);
					if (dev) warnings.push(`ERP HCM (SGN) unavailable: ${msg}`);
				}
			} else if (user.site === "HAN" || user.site === "DAD") {
				const domain = user.site;
				const [settled] = await Promise.allSettled([
					queryERPHAN<PartnerResult>(PARTNERS_QUERY),
				]);
				if (settled.status === "fulfilled") {
					mergedRows = (settled.value.recordset ?? []).map((row) => ({
						...row,
						domain,
					}));
				} else {
					const msg =
						settled.reason instanceof Error
							? settled.reason.message
							: String(settled.reason);
					console.error(`Partners ERP query failed for site ${domain}:`, msg);
					if (dev) warnings.push(`ERP HN (${domain}) unavailable: ${msg}`);
				}
			} else {
				return NextResponse.json(
					{ message: "Invalid user site" },
					{ status: 400 },
				);
			}
		}

		const partners = rowsToPartners(mergedRows);

		return NextResponse.json({
			partners,
			...(dev && warnings.length > 0 ? { warning: warnings.join(" | ") } : {}),
		});
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		console.error("Error fetching partners:", detail, error);
		if (dev) {
			return NextResponse.json({
				partners: [],
				warning: `Partners unavailable: ${detail}`,
			});
		}
		return NextResponse.json({ partners: [] });
	}
}
