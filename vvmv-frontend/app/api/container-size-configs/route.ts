import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";
import { tryDelegateToStandaloneApi } from "@/lib/proxy-backend";

// GET /api/container-size-configs
// Returns all configs, optionally filtered by ?site=SGN or ?containerSize=20DC
export async function GET(req: NextRequest) {
	const delegated = await tryDelegateToStandaloneApi(
		req,
		"container-size-configs",
	);
	if (delegated) return delegated;

	const { searchParams } = new URL(req.url);
	const site = searchParams.get("site");
	const containerSize = searchParams.get("containerSize");

	const where: any = {};
	if (site) where.site = site;
	if (containerSize) where.containerSize = containerSize;

	const configs = await prismaRPA.containerSizeConfig.findMany({
		where,
		orderBy: [{ site: "asc" }, { containerSize: "asc" }],
	});

	return NextResponse.json({ configs });
}
