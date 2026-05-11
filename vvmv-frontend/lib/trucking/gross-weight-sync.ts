import { prismaRPA } from "@/lib/db";

/**
 * Recalculates and updates the total Gross Weight for a TruckingFollowUp record.
 * The total is the sum of GD from:
 * 1. Containers directly linked to the TruckingFollowUp
 * 2. Containers linked to Logistics FollowUps that share the same requestNumber or jobNumber
 *
 * @param truckingFollowUpId The ID of the TruckingFollowUp record to sync
 */
export async function syncTruckingGrossWeight(truckingFollowUpId: string) {
	try {
		const tf = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			select: { id: true, requestNumber: true, jobNumber: true },
		});

		if (!tf) return;

		// 1. Get direct containers
		const directContainers = await prismaRPA.container.findMany({
			where: { truckingFollowUpId: tf.id },
			select: { grossWeight: true },
		});

		// 2. Get linked containers via logistics follow-ups
		const linkedContainers = await prismaRPA.container.findMany({
			where: {
				followUp: {
					OR: [
						{ requestTruckingNo: tf.requestNumber || "undefined_sync_val" },
						{ jobNumber: tf.jobNumber || "undefined_sync_val" },
					],
				},
			},
			select: { grossWeight: true },
		});

		// 3. Get FCRs
		const fcrs = await prismaRPA.fCR.findMany({
			where: { truckingFollowUpId: tf.id },
			select: { grossWeight: true },
		});

		// 4. Calculate total
		let totalGW = 0;
		const containerSum = [...directContainers, ...linkedContainers].reduce(
			(sum, c) => sum + (Number(c.grossWeight) || 0),
			0,
		);

		if (
			containerSum > 0 ||
			directContainers.length > 0 ||
			linkedContainers.length > 0
		) {
			// If containers exist, use their sum (existing logic)
			totalGW = containerSum;
		} else {
			// If no containers, sum up FCRs
			totalGW = fcrs.reduce((sum, f) => sum + (Number(f.grossWeight) || 0), 0);
		}

		// 5. Update the trucking record
		await prismaRPA.truckingFollowUp.update({
			where: { id: tf.id },
			data: { grossWeight: totalGW },
		});

		console.log(`Sync GW for Trucking ID ${tf.id}: Total = ${totalGW}`);
		return totalGW;
	} catch (error) {
		console.error(
			`Error syncing Gross Weight for Trucking ID ${truckingFollowUpId}:`,
			error,
		);
		throw error;
	}
}

/**
 * Finds all related TruckingFollowUp IDs for a given container
 * @param containerId The ID of the container
 */
export async function findRelatedTruckingIds(
	containerId: string,
): Promise<string[]> {
	const container = await prismaRPA.container.findUnique({
		where: { id: containerId },
		include: {
			followUp: {
				select: { requestTruckingNo: true, jobNumber: true },
			},
		},
	});

	if (!container) return [];

	const ids = new Set<string>();
	if (container.truckingFollowUpId) {
		ids.add(container.truckingFollowUpId);
	}

	if (container.followUp?.requestTruckingNo || container.followUp?.jobNumber) {
		const linkedTfs = await prismaRPA.truckingFollowUp.findMany({
			where: {
				OR: [
					{
						requestNumber:
							container.followUp.requestTruckingNo || "undefined_sync_val",
					},
					{ jobNumber: container.followUp.jobNumber || "undefined_sync_val" },
				],
			},
			select: { id: true },
		});
		linkedTfs.forEach((tf) => ids.add(tf.id));
	}

	return Array.from(ids);
}
