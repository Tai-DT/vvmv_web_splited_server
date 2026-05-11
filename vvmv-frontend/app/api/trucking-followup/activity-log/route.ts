import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/trucking-followup/activity-log?id=xxx&page=1&pageSize=50
 * Returns paginated activity logs for a trucking follow-up job.
 * Also includes container-related logs from the FollowUpActivityLog table
 * (because ContainersPanel is shared and logs may be written to either table).
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
		const pageSize = Math.min(
			100,
			Math.max(1, Number(searchParams.get("pageSize") ?? "50")),
		);

		if (!id) {
			return NextResponse.json(
				{ message: "Missing required param: id" },
				{ status: 400 },
			);
		}

		// 1. Fetch trucking activity logs (primary)
		const truckingLogs = await prismaRPA.truckingActivityLog.findMany({
			where: { truckingFollowUpId: id },
			orderBy: { createdAt: "desc" },
		});

		// 2. Find related logistics FollowUp IDs via requestNumber / jobNumber
		//    (containers may belong to logistics followUp, not directly to trucking)
		const truckingJob = await prismaRPA.truckingFollowUp.findUnique({
			where: { id },
			select: { requestNumber: true, jobNumber: true },
		});

		let crossLogs: any[] = [];

		if (truckingJob) {
			const orConditions: any[] = [];
			if (truckingJob.requestNumber) {
				orConditions.push({ requestTruckingNo: truckingJob.requestNumber });
			}
			if (truckingJob.jobNumber) {
				orConditions.push({ jobNumber: truckingJob.jobNumber });
			}

			if (orConditions.length > 0) {
				// Find linked logistics followUps
				const linkedFollowUps = await prismaRPA.followUp.findMany({
					where: { OR: orConditions, isDeleted: false },
					select: { id: true },
				});

				const followUpIds = linkedFollowUps.map((f) => f.id);

				if (followUpIds.length > 0) {
					// Fetch ALL container-related logs from those logistics followUps
					crossLogs = await prismaRPA.followUpActivityLog.findMany({
						where: {
							followUpId: { in: followUpIds },
							subResource: "container",
						},
						orderBy: { createdAt: "desc" },
					});
				}
			}
		}

		// 3. Merge, deduplicate by id, sort by createdAt desc
		const seenIds = new Set(truckingLogs.map((l) => l.id));
		const merged = [...truckingLogs];
		for (const log of crossLogs) {
			if (!seenIds.has(log.id)) {
				merged.push(log);
				seenIds.add(log.id);
			}
		}
		merged.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		// 4. Paginate the merged result
		const total = merged.length;
		const paginated = merged.slice((page - 1) * pageSize, page * pageSize);

		return NextResponse.json({ logs: paginated, total }, { status: 200 });
	} catch (error) {
		console.error("Error fetching trucking activity logs:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch activity logs",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
