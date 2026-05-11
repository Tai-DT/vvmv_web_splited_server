import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA, queryERPHAN, queryERPHCM } from "@/lib/db";
import { getDriveClient } from "@/lib/google-sheets/client";

function extractDriveFolderId(url?: string | null): string | null {
	if (!url) return null;
	const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
	return match?.[1] ?? null;
}

async function moveFolderChildrenToFolder(
	sourceFolderId: string,
	targetFolderId: string,
) {
	if (!sourceFolderId || !targetFolderId || sourceFolderId === targetFolderId) {
		return;
	}

	const drive = getDriveClient();
	let pageToken: string | undefined;

	do {
		const listRes = await drive.files.list({
			q: `'${sourceFolderId}' in parents and trashed=false`,
			fields: "nextPageToken, files(id, parents)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
			pageSize: 200,
			pageToken,
		});

		const files = listRes.data.files ?? [];
		await Promise.all(
			files
				.filter((f) => !!f.id)
				.map(async (f) => {
					try {
						const previousParents = f.parents?.join(",") ?? sourceFolderId;
						await drive.files.update({
							fileId: f.id!,
							addParents: targetFolderId,
							removeParents: previousParents,
							supportsAllDrives: true,
							fields: "id",
						});
					} catch (error) {
						console.error("Failed to move file during combine-jobs:", {
							fileId: f.id,
							error,
						});
					}
				}),
		);

		pageToken = listRes.data.nextPageToken ?? undefined;
	} while (pageToken);
}

/**
 * POST /api/trucking-followup/combine-jobs
 * Combines multiple trucking jobs into one keeper job.
 *
 * DB (web):
 *   - TruckingFollowUp rows to delete → isDeleted = true
 *   - FCR rows of deleted jobs → truckingFollowUpId = keeperId
 *
 * DB (ERP):
 *   - TransactionDetails rows of deleted jobs → transid = keeperJobNumber
 *     with lotno resequenced starting after the keeper's current max lotno
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { keeperJobId, deleteJobIds, requiredTruckingNumberId } = body as {
			keeperJobId: string;
			deleteJobIds: string[];
			requiredTruckingNumberId?: string;
		};

		if (!keeperJobId || !deleteJobIds || deleteJobIds.length === 0) {
			return NextResponse.json(
				{ message: "keeperJobId and deleteJobIds are required" },
				{ status: 400 },
			);
		}

		if (deleteJobIds.includes(keeperJobId)) {
			return NextResponse.json(
				{ message: "Keeper job cannot be in the delete list" },
				{ status: 400 },
			);
		}

		// 1. Load keeper job
		const keeper = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: keeperJobId },
			select: {
				id: true,
				jobNumber: true,
				domain: true,
				isFinished: true,
				driveUrl: true,
				handler: true,
				ops: true,
				ccgh: true,
				note: true,
			},
		});

		if (!keeper) {
			return NextResponse.json(
				{ message: "Keeper job not found" },
				{ status: 404 },
			);
		}

		if (keeper.isFinished) {
			return NextResponse.json(
				{ message: "Không thể gộp: Job giữ lại đã hoàn thành." },
				{ status: 403 },
			);
		}

		// 2. Load jobs to delete — verify they exist and are not finished
		const jobsToDelete = await prismaRPA.truckingFollowUp.findMany({
			where: { id: { in: deleteJobIds } },
			select: {
				id: true,
				jobNumber: true,
				isFinished: true,
				driveUrl: true,
				handler: true,
				ops: true,
				ccgh: true,
				note: true,
			},
		});

		const finishedJob = jobsToDelete.find((j) => j.isFinished);
		if (finishedJob) {
			return NextResponse.json(
				{
					message: `Không thể gộp: Job ${finishedJob.jobNumber} đã hoàn thành.`,
				},
				{ status: 403 },
			);
		}

		const deleteJobNumbers = jobsToDelete
			.map((j) => j.jobNumber)
			.filter(Boolean) as string[];

		const hasValue = (value?: string | null) =>
			typeof value === "string" && value.trim().length > 0;

		const jobsToDeleteById = new Map(jobsToDelete.map((j) => [j.id, j]));
		const orderedJobsToDelete = deleteJobIds
			.map((id) => jobsToDeleteById.get(id))
			.filter((job): job is (typeof jobsToDelete)[number] => Boolean(job));

		const fallbackHandler = orderedJobsToDelete.find((j) =>
			hasValue(j.handler),
		)?.handler;
		const fallbackOps = orderedJobsToDelete.find((j) => hasValue(j.ops))?.ops;

		const keeperPatch: { handler?: string; ops?: string } = {};
		if (!hasValue(keeper.handler) && hasValue(fallbackHandler)) {
			keeperPatch.handler = fallbackHandler?.trim();
		}
		if (!hasValue(keeper.ops) && hasValue(fallbackOps)) {
			keeperPatch.ops = fallbackOps?.trim();
		}

		// 2b. Optional guard for dispatch combine:
		// block if any job has FCR spread across multiple trucks or outside the target truck.
		if (requiredTruckingNumberId) {
			const jobIdsToValidate = [keeperJobId, ...deleteJobIds];
			const allFcrInJobs = await prismaRPA.fCR.findMany({
				where: { truckingFollowUpId: { in: jobIdsToValidate } },
				select: { truckingFollowUpId: true, truckingNumberId: true },
			});

			const truckSetByJob = new Map<string, Set<string>>();
			for (const item of allFcrInJobs) {
				const jobId = item.truckingFollowUpId;
				if (!jobId) continue;
				const set = truckSetByJob.get(jobId) ?? new Set<string>();
				set.add(item.truckingNumberId ?? "__unassigned__");
				truckSetByJob.set(jobId, set);
			}

			const jobNumberById = new Map<string, string>([
				[keeper.id, keeper.jobNumber ?? keeper.id],
				...jobsToDelete.map<[string, string]>((j) => [
					j.id,
					j.jobNumber ?? j.id,
				]),
			]);

			const invalidJobs = jobIdsToValidate
				.map((jobId) => {
					const trucks = truckSetByJob.get(jobId) ?? new Set<string>();
					const isValid =
						trucks.size === 1 && trucks.has(requiredTruckingNumberId);
					return isValid ? null : (jobNumberById.get(jobId) ?? jobId);
				})
				.filter(Boolean) as string[];

			if (invalidJobs.length > 0) {
				return NextResponse.json(
					{
						message:
							"Không thể combine: có job không nằm trọn trên cùng 1 xe/vendor.",
						invalidJobs,
					},
					{ status: 409 },
				);
			}
		}

		// 3. ERP: move TransactionDetails rows from deleted jobs → keeper
		if (keeper.jobNumber && deleteJobNumbers.length > 0) {
			const siteMap: Record<string, string> = {
				SGN: "HCM",
				DAD: "HAN",
				HAN: "HAN",
			};
			const erpSite = siteMap[keeper.domain || "SGN"] || "HCM";
			const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;

			// Build parameterized placeholders for the IN clause
			const inParams: Record<string, string> = {};
			deleteJobNumbers.forEach((jn, i) => {
				inParams[`deleteJob${i}`] = jn;
			});
			const inPlaceholders = deleteJobNumbers
				.map((_, i) => `@deleteJob${i}`)
				.join(", ");

			const sql = `
        BEGIN TRANSACTION;
        BEGIN TRY
          DECLARE @MAXLOT INT;

          SELECT @MAXLOT = ISNULL(MAX(CAST(lotno AS INT)), 0)
          FROM TransactionDetails
          WHERE transid = @keeperJob;

          WITH CTE AS (
            SELECT *,
              ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
            FROM TransactionDetails
            WHERE transid IN (${inPlaceholders})
          )
          UPDATE CTE
          SET transid = @keeperJob, cdsExtra = 1,
              lotno = RIGHT('00000' + CAST(@MAXLOT + rn AS VARCHAR(5)), 5);

          DELETE FROM transactions 
          WHERE transid IN (${inPlaceholders});

          COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
          ROLLBACK TRANSACTION;
          THROW;
        END CATCH;
      `;

			await erpQuery(sql, { keeperJob: keeper.jobNumber, ...inParams });
		}

		// 3b. Drive: move all files from deleted jobs' drive folders into keeper folder.
		const keeperFolderId = extractDriveFolderId(keeper.driveUrl);
		if (keeperFolderId) {
			for (const job of jobsToDelete) {
				const sourceFolderId = extractDriveFolderId(job.driveUrl);
				if (!sourceFolderId || sourceFolderId === keeperFolderId) continue;
				await moveFolderChildrenToFolder(sourceFolderId, keeperFolderId);
			}
		}

		// 4. Prepare isCombined by shipper across keeper + deleted jobs:
		// - first FCR line of each shipper => isCombined = false
		// - second line onward => isCombined = true
		const allRelatedJobIds = [keeperJobId, ...deleteJobIds];
		const relatedFcrs = await prismaRPA.fCR.findMany({
			where: { truckingFollowUpId: { in: allRelatedJobIds } },
			select: {
				id: true,
				shipper: true,
				fcrNumber: true,
				truckingFollowUpId: true,
				notes: true,
			},
		});

		const shipperGroups = new Map<string, typeof relatedFcrs>();
		for (const fcr of relatedFcrs) {
			const shipperKey =
				(fcr.shipper ?? "").trim().toLowerCase() || "__empty__";
			const group = shipperGroups.get(shipperKey) ?? [];
			group.push(fcr);
			shipperGroups.set(shipperKey, group);
		}

		const shouldBeTrueIds = new Set<string>();
		for (const group of shipperGroups.values()) {
			group.sort((a, b) => {
				const keeperFirst =
					Number(b.truckingFollowUpId === keeperJobId) -
					Number(a.truckingFollowUpId === keeperJobId);
				if (keeperFirst !== 0) return keeperFirst;

				const byFcrNumber = (a.fcrNumber ?? "").localeCompare(
					b.fcrNumber ?? "",
				);
				if (byFcrNumber !== 0) return byFcrNumber;

				return a.id.localeCompare(b.id);
			});

			// index 0 => false, index >= 1 => true
			group.slice(1).forEach((fcr) => shouldBeTrueIds.add(fcr.id));
		}

		// 4b. Merge ccgh (delivery certificate URLs) from deleted jobs into keeper
		const mergedCcgh = [
			...new Set([
				...(keeper.ccgh ?? []),
				...jobsToDelete.flatMap((j) => j.ccgh ?? []),
			]),
		];

		// 5. Web DB: reassign FCRs + update isCombined + soft-delete jobs (in a transaction)
		await prismaRPA.$transaction(async (tx) => {
			await tx.truckingFollowUp.update({
				where: { id: keeperJobId },
				data: {
					...keeperPatch,
					ccgh: mergedCcgh,
				},
			});

			// Reassign FCRs from deleted jobs to keeper + Update notes from job to FCR
			const jobNotesMap = new Map<string, string>();
			if (keeper.note?.trim()) jobNotesMap.set(keeper.id, keeper.note.trim());
			for (const job of jobsToDelete) {
				if (job.note?.trim()) jobNotesMap.set(job.id, job.note.trim());
			}

			for (const fcr of relatedFcrs) {
				const jobNote = fcr.truckingFollowUpId
					? jobNotesMap.get(fcr.truckingFollowUpId)
					: null;
				if (jobNote) {
					const updatedFcrNotes = fcr.notes?.trim()
						? `${fcr.notes.trim()}\n${jobNote}`
						: jobNote;

					await tx.fCR.update({
						where: { id: fcr.id },
						data: {
							truckingFollowUpId: keeperJobId,
							notes: updatedFcrNotes,
						},
					});
				} else {
					// If no job note to append, still need to reassign to keeper if it was from a deleted job
					if (deleteJobIds.includes(fcr.truckingFollowUpId!)) {
						await tx.fCR.update({
							where: { id: fcr.id },
							data: { truckingFollowUpId: keeperJobId },
						});
					}
				}
			}

			// Reset all related rows first, then mark 2nd+ line of each shipper as true
			await tx.fCR.updateMany({
				where: { id: { in: relatedFcrs.map((f) => f.id) } },
				data: { isCombined: false },
			});

			if (shouldBeTrueIds.size > 0) {
				await tx.fCR.updateMany({
					where: { id: { in: [...shouldBeTrueIds] } },
					data: { isCombined: true },
				});
			}

			// Soft-delete the jobs
			await tx.truckingFollowUp.updateMany({
				where: { id: { in: deleteJobIds } },
				data: {
					isDeleted: true,
					// Keep trace of which job this row was merged into.
					parentJobNumber: keeper.jobNumber ?? null,
				},
			});
		});

		// 6. ERP: sync cdsExtra to match final FCR.isCombined in keeper job
		// cdsExtra = 1 <=> isCombined = true, cdsExtra = 0 <=> isCombined = false
		if (keeper.jobNumber) {
			const keeperFcrs = await prismaRPA.fCR.findMany({
				where: { truckingFollowUpId: keeperJobId },
				select: { fcrNumber: true, isCombined: true },
			});

			const allFcrNumbers = keeperFcrs
				.map((f) => (f.fcrNumber ?? "").trim())
				.filter((v): v is string => !!v);

			if (allFcrNumbers.length > 0) {
				const trueFcrNumbers = keeperFcrs
					.filter((f) => f.isCombined === true)
					.map((f) => (f.fcrNumber ?? "").trim())
					.filter((v): v is string => !!v);

				const siteMap: Record<string, string> = {
					SGN: "HCM",
					DAD: "HAN",
					HAN: "HAN",
				};
				const erpSite = siteMap[keeper.domain || "SGN"] || "HCM";
				const erpQuery = erpSite === "HCM" ? queryERPHCM : queryERPHAN;

				const allParams: Record<string, string> = {};
				allFcrNumbers.forEach((no, i) => {
					allParams[`allFcr${i}`] = no;
				});
				const allPlaceholders = allFcrNumbers
					.map((_, i) => `@allFcr${i}`)
					.join(", ");

				if (trueFcrNumbers.length > 0) {
					const trueParams: Record<string, string> = {};
					trueFcrNumbers.forEach((no, i) => {
						trueParams[`trueFcr${i}`] = no;
					});
					const truePlaceholders = trueFcrNumbers
						.map((_, i) => `@trueFcr${i}`)
						.join(", ");

					const syncSql = `
            UPDATE TransactionDetails
            SET cdsExtra = CASE WHEN HWBNO IN (${truePlaceholders}) THEN 1 ELSE 0 END
            WHERE transid = @keeperJob
              AND HWBNO IN (${allPlaceholders});
          `;

					await erpQuery(syncSql, {
						keeperJob: keeper.jobNumber,
						...allParams,
						...trueParams,
					});
				} else {
					const resetSql = `
            UPDATE TransactionDetails
            SET cdsExtra = 0
            WHERE transid = @keeperJob
              AND HWBNO IN (${allPlaceholders});
          `;

					await erpQuery(resetSql, {
						keeperJob: keeper.jobNumber,
						...allParams,
					});
				}
			}
		}

		// 7. Activity log (fire-and-forget)
		logTruckingActivity(keeperJobId, {
			userId: session.user.id,
			userName: session.user.name,
			action: "COMBINE_JOBS",
			subResource: "job",
			subResourceId: keeper.jobNumber ?? keeperJobId,
			newValue: {
				mergedFrom: deleteJobNumbers,
				keeperJobNumber: keeper.jobNumber,
			},
		});

		return NextResponse.json({
			success: true,
			keeperJobNumber: keeper.jobNumber,
			mergedCount: deleteJobIds.length,
		});
	} catch (error) {
		console.error("Combine jobs error:", error);
		return NextResponse.json(
			{
				message: "Failed to combine jobs",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
