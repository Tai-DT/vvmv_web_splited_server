import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

/**
 * GET /api/followup/activity-log?id=xxx&page=1&pageSize=50
 * Returns paginated activity logs for a logistics follow-up job.
 * Also includes container-related logs from the TruckingActivityLog table
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

		// 1. Fetch follow-up activity logs (primary)
		const followUpLogs = await prismaRPA.followUpActivityLog.findMany({
			where: { followUpId: id },
			orderBy: { createdAt: "desc" },
		});

		// 2. Find related trucking FollowUp IDs via requestTruckingNo / jobNumber
		//    (containers may belong to trucking followUp, not directly to logistics)
		const followUpJob = await prismaRPA.followUp.findUnique({
			where: { id },
			select: { requestTruckingNo: true, jobNumber: true },
		});

		let crossLogs: any[] = [];

		if (followUpJob) {
			const orConditions: any[] = [];
			if (followUpJob.requestTruckingNo) {
				orConditions.push({ requestNumber: followUpJob.requestTruckingNo });
			}
			if (followUpJob.jobNumber) {
				orConditions.push({ jobNumber: followUpJob.jobNumber });
			}

			if (orConditions.length > 0) {
				// Find linked trucking followUps
				const linkedTruckingJobs = await prismaRPA.truckingFollowUp.findMany({
					where: { OR: orConditions, isDeleted: false },
					select: { id: true },
				});

				const truckingIds = linkedTruckingJobs.map((t) => t.id);

				if (truckingIds.length > 0) {
					// Fetch ALL container-related logs from those trucking followUps
					crossLogs = await prismaRPA.truckingActivityLog.findMany({
						where: {
							truckingFollowUpId: { in: truckingIds },
							subResource: "container",
						},
						orderBy: { createdAt: "desc" },
					});
				}
			}
		}

		// 3. Merge, deduplicate by id, sort by createdAt desc
		const seenIds = new Set(followUpLogs.map((l) => l.id));
		const merged = [...followUpLogs];
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
		console.error("Error fetching follow-up activity logs:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch activity logs",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
