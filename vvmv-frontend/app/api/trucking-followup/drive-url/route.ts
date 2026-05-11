import { type NextRequest, NextResponse } from "next/server";
import { prismaRPA } from "@/lib/db";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json({ driveUrl: null });
		}

		const job = await prismaRPA.truckingFollowUp.findUnique({
			where: { id },
			select: { driveUrl: true, requestNumber: true, jobNumber: true },
		});

		if (!job) {
			return NextResponse.json({ driveUrl: null });
		}

		let resolvedDriveUrl = job.driveUrl;

		// Prioritize linked FollowUp (Logistics job) driveUrl
		const orConditions: any[] = [];
		if (job.requestNumber) {
			orConditions.push({ requestTruckingNo: job.requestNumber });
		}
		if (job.jobNumber) {
			orConditions.push({ jobNumber: job.jobNumber });
		}

		if (orConditions.length > 0) {
			const parentJob = await prismaRPA.followUp.findFirst({
				where: { OR: orConditions, isDeleted: false },
				select: { driveUrl: true },
			});
			if (parentJob?.driveUrl) {
				resolvedDriveUrl = parentJob.driveUrl;
			}
		}

		return NextResponse.json({ driveUrl: resolvedDriveUrl || null });
	} catch (error: any) {
		console.error("Error fetching driveUrl for trucking job:", error);
		return NextResponse.json({ driveUrl: null }, { status: 500 });
	}
}
