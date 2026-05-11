import { format } from "date-fns";
import { prismaRPA } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";

export async function sendAutoOpsMail(
	truckingFollowUpId: string,
	opsName: string,
	accessToken: string,
	userEmail: string,
) {
	try {
		// 1. Check if OPS has autoMail = true
		const opsRecord = await prismaRPA.ops.findFirst({
			where: { name: opsName },
			select: { name: true, autoMail: true, emails: true },
		});

		if (
			!opsRecord ||
			!opsRecord.autoMail ||
			!opsRecord.emails ||
			opsRecord.emails.length === 0
		) {
			return;
		}

		// 2. Fetch Job Details
		const job = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			include: {
				fcrs: {
					where: { ops: opsName }, // Only FCRs belonging to this OPS
					include: {
						container: {
							select: {
								id: true,
								containerNo: true,
								containerSize: true,
								cutOffTime: true,
								declarationLinks: {
									select: {
										declaration: {
											select: { id: true, declarationNumber: true },
										},
									},
								},
							},
						},
					},
				},
				declarations: { select: { id: true, declarationNumber: true } },
			},
		});

		if (!job || job.fcrs.length === 0) return;

		const jobNumber = job.jobNumber || "";
		if (!jobNumber) return;

		// Build Logistics emails (CC)
		const orConditions: any[] = [];
		if (job.requestNumber)
			orConditions.push({ requestTruckingNo: job.requestNumber });
		if (job.jobNumber) orConditions.push({ jobNumber: job.jobNumber });

		let linkedFollowUp: {
			driveUrl?: string | null;
			handler?: string | null;
			createdBy?: string | null;
		} | null = null;
		let logisticsCcEmails: string[] = [];
		if (orConditions.length > 0) {
			linkedFollowUp = await prismaRPA.followUp.findFirst({
				where: { OR: orConditions, isDeleted: false },
				select: {
					driveUrl: true,
					handler: true,
					createdBy: true,
					jobNumber: true,
				},
			});

			if (linkedFollowUp) {
				const idsToFetch = [];
				if (linkedFollowUp.handler)
					idsToFetch.push(linkedFollowUp.handler.trim());
				if (linkedFollowUp.createdBy)
					idsToFetch.push(linkedFollowUp.createdBy.trim());

				if (idsToFetch.length > 0) {
					const users = await prismaRPA.user.findMany({
						where: {
							OR: [
								{ id: { in: idsToFetch } },
								{ email: { in: idsToFetch } },
								{ username: { in: idsToFetch } },
							],
						},
						select: { email: true },
					});
					logisticsCcEmails = users.map((u) => u.email).filter(Boolean);
				}
			}
		}

		// FollowUp / Declaration mappings (same as compose-mail)
		const requestNumbersNeedingFollowUp = [
			...new Set(
				job.fcrs
					.filter(
						(f) =>
							(f.container?.declarationLinks ?? []).length === 0 &&
							job.requestNumber,
					)
					.map(() => job.requestNumber!),
			),
		];

		const followUpDeclMap = new Map<string, string[]>();
		if (requestNumbersNeedingFollowUp.length > 0) {
			const followUps = await prismaRPA.followUp.findMany({
				where: {
					requestTruckingNo: { in: requestNumbersNeedingFollowUp },
					isDeleted: false,
				},
				select: {
					requestTruckingNo: true,
					declarations: { select: { declarationNumber: true } },
				},
			});
			for (const fu of followUps) {
				if (!fu.requestTruckingNo) continue;
				const nums = fu.declarations
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
				const existing = followUpDeclMap.get(fu.requestTruckingNo) ?? [];
				followUpDeclMap.set(fu.requestTruckingNo, [...existing, ...nums]);
			}
		}

		const fcrDeclMap = new Map<string, string[]>();
		for (const fcr of job.fcrs) {
			const containerDecls = fcr.container?.declarationLinks ?? [];
			let declNums: string[];
			if (containerDecls.length > 0) {
				declNums = containerDecls
					.map((l) => l.declaration.declarationNumber)
					.filter((n): n is string => Boolean(n));
			} else if (job.requestNumber) {
				declNums = followUpDeclMap.get(job.requestNumber) ?? [];
			} else {
				declNums = (job.declarations ?? [])
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
			}
			fcrDeclMap.set(fcr.id, [...new Set(declNums)]);
		}

		// Format subject
		const opType =
			job.operationType?.toUpperCase() === "XUAT"
				? "Xuất"
				: job.operationType?.toUpperCase() === "NHAP"
					? "Nhập"
					: job.operationType || "";
		const serviceMode = job.serviceMode || "";
		const company = job.companyName || "";
		const bill = job.billOrBooking || "";

		const fcrImplDates = [
			...new Set(
				job.fcrs
					.map((f) => {
						const d = f.implementationDate
							? new Date(f.implementationDate)
							: null;
						return d && !Number.isNaN(d.getTime()) ? d : null;
					})
					.filter((d) => d !== null)
					.sort((a, b) => a?.getTime() - b?.getTime())
					.map((d) => format(d!, "dd/MM/yyyy")),
			),
		];

		const jobImplDate =
			fcrImplDates.length > 0
				? fcrImplDates.join(", ")
				: job.implementationDate
					? format(new Date(job.implementationDate), "dd/MM/yyyy")
					: "";
		let subject = [opType, serviceMode, company, bill, jobNumber, jobImplDate]
			.filter(Boolean)
			.join(" + ");

		// Fetch Drive Files matching prefixes
		const driveUrl = job.driveUrl || linkedFollowUp?.driveUrl || "";
		const driveFileIdsToAttach: string[] = [];
		const validPrefixes = ["INV", "BILL", "BKG", "PKL", "LCC", "AN"];

		if (driveUrl) {
			const match = driveUrl.match(/(?:folders\/|id=)([\w-]+)/);
			if (match?.[1]) {
				try {
					const { getDriveClient } = await import("@/lib/google-sheets/client");
					const drive = getDriveClient();
					const response = await drive.files.list({
						q: `'${match[1]}' in parents and trashed=false`,
						fields: "files(id, name, mimeType)",
						includeItemsFromAllDrives: true,
						supportsAllDrives: true,
					});

					// Check if any file name starts with the required prefixes
					const processFile = (file: any) => {
						const upName = file.name?.toUpperCase() || "";
						if (validPrefixes.some((prefix) => upName.startsWith(prefix))) {
							driveFileIdsToAttach.push(file.id!);
						}
					};

					for (const item of response.data.files || []) {
						if (item.mimeType === "application/vnd.google-apps.folder") {
							const subRes = await drive.files.list({
								q: `'${item.id}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
								fields: "files(id, name, mimeType)",
								includeItemsFromAllDrives: true,
								supportsAllDrives: true,
							});
							subRes.data.files?.forEach(processFile);
						} else {
							processFile(item);
						}
					}
				} catch (e) {
					console.error("Error fetching drive files for OPS auto mail:", e);
				}
			}
		}

		// Build Body
		// Vendor FCR map
		const vendorFcrMapForOps = new Map<string, typeof job.fcrs>();
		for (const f of job.fcrs) {
			const v = f.vendor || "Không rõ Vendor";
			if (!vendorFcrMapForOps.has(v)) vendorFcrMapForOps.set(v, []);
			vendorFcrMapForOps.get(v)?.push(f);
		}

		// Fetch Warehouses
		const allWarehouseNames = Array.from(
			new Set(job.fcrs.map((f) => f.warehouse).filter(Boolean) as string[]),
		);
		const warehouseConfigs =
			allWarehouseNames.length > 0
				? await prismaRPA.warehouseConfig.findMany({
						where: { warehouseName: { in: allWarehouseNames } },
						select: {
							warehouseName: true,
							deliveryAddress: true,
							contactInfo: true,
							invoiceInfo: true,
							mapPosition: true,
							notes: true,
						},
					})
				: [];
		const warehouseConfigMap = new Map(
			warehouseConfigs.map((wc) => [wc.warehouseName, wc]),
		);

		const isFcl = (job.serviceMode || "").toUpperCase().includes("FCL");
		const _isHcmFcl = jobNumber.toUpperCase().startsWith("HCM") && isFcl;
		const esc = (s: string | null | undefined) =>
			(s ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		const allVendorSections = Array.from(vendorFcrMapForOps.entries())
			.map(([vendorName, fcrs]) => {
				const whFcrMap2 = new Map<string, typeof fcrs>();
				for (const f of fcrs) {
					const key = f.warehouse || "";
					if (!whFcrMap2.has(key)) whFcrMap2.set(key, []);
					whFcrMap2.get(key)?.push(f);
				}

				const warehouseSections2 = Array.from(whFcrMap2.entries())
					.map(([whName, whFcrs], idx) => {
						const wh = warehouseConfigMap.get(whName);
						const hasContainerData2 = whFcrs.some(
							(f) => f.container?.containerNo || f.containerNo,
						);
						const showCutOff2 = hasContainerData2;

						const containerThCell2 = hasContainerData2
							? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CONTAINER</th>`
							: "";
						const cutOffThCell2 = showCutOff2
							? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CUT OFF</th>`
							: "";

						const fcrInnerRows2 = whFcrs
							.map((f) => {
								const dateStr = f.implementationDate
									? format(new Date(f.implementationDate), "dd/MM/yyyy")
									: "—";
								const fcrNo = f.fcrNumber || "Không có số";
								const noteCell = f.notes
									? `<span style="color:#94a3b8;font-style:italic;font-size:11px;"> — ${esc(f.notes)}</span>`
									: "";
								const vendorCell = `<td style="padding:5px 12px;font-size:12px;color:#7c3aed;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-weight:600;">${esc(vendorName)}</td>`;
								const declNums2 = fcrDeclMap.get(f.id) ?? [];
								const declCell2 =
									declNums2.length > 0
										? declNums2
												.map(
													(n) =>
														`<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:11px;font-weight:600;margin:1px;">${esc(n)}</span>`,
												)
												.join(" ")
										: `<span style="color:#94a3b8;font-size:11px;font-style:italic;">—</span>`;
								const containerCell2 = hasContainerData2
									? `<td style="padding:5px 12px;font-size:12px;color:#1e293b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(f.container?.containerNo || f.containerNo || "—")}<span style="color:#94a3b8;font-size:10px;margin-left:4px;">${esc(f.container?.containerSize || "")}</span></td>`
									: "";
								const cutOffCell2 = showCutOff2
									? (() => {
											const ct = f.container?.cutOffTime;
											return `<td style="padding:5px 12px;font-size:12px;color:#b45309;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-weight:600;">${ct ? format(new Date(ct), "dd/MM HH:mm") : "—"}</td>`;
										})()
									: "";

								return `<tr>${vendorCell}<td style="padding:5px 12px;font-size:12px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">${esc(fcrNo)}${noteCell}</td><td style="padding:5px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(dateStr)}</td>${containerCell2}${cutOffCell2}<td style="padding:5px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;">${declCell2}</td></tr>`;
							})
							.join("");

						const borderTop2 = idx > 0 ? "margin-top:20px;" : "";
						if (!wh) {
							return `<div style="${borderTop2}border:1px solid #e2e8f0;border-radius:6px;padding:10px;">Missing warehouse config for: ${esc(whName)}</div>`;
						}

						return `<div style="${borderTop2}border:1px solid #e2e8f0;border-radius:6px;overflow-x:auto;max-width:100%;">
          <table style="border-collapse:collapse;width:100%;background:#f0f9ff;">
            <tr><td colspan="2" style="padding:8px 14px 6px;font-weight:700;font-size:13px;color:#0369a1;border-bottom:1px solid #bae6fd;">🏭 ${esc(whName)}</td></tr>
            <tr><td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;width:210px;">Địa chỉ đóng hàng</td><td style="padding:5px 14px;font-size:12px;color:#1e293b;">${esc(wh.deliveryAddress)}</td></tr>
            <tr style="background:#e0f2fe;"><td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin liên hệ lấy hàng</td><td style="padding:5px 14px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc(wh.contactInfo)}</td></tr>
            <tr><td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin xuất hoá đơn</td><td style="padding:5px 14px 8px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc(wh.invoiceInfo)}</td></tr>
            ${wh.mapPosition ? `<tr style="background:#f0fdf4;"><td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">📍 Định vị kho</td><td style="padding:5px 14px 8px;font-size:12px;"><a href="${wh.mapPosition}" style="color:#0369a1;font-weight:600;">Xem trên Google Maps</a></td></tr>` : ""}
          </table>
          ${wh.notes ? `<div style="margin:10px 14px 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:4px;"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">⚠️ Lưu ý</div><div style="font-size:12px;color:#78350f;white-space:pre-line;">${esc(wh.notes)}</div></div>` : ""}
          <table style="border-collapse:collapse;width:100%;background:#ffffff;">
            <tr style="background:#f8fafc;"><th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">VENDOR</th><th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">SỐ FCR</th><th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">NGÀY THỰC HIỆN</th>${containerThCell2}${cutOffThCell2}<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">TỜ KHAI</th></tr>
            ${fcrInnerRows2}
          </table>
        </div>`;
					})
					.join("");
				return warehouseSections2;
			})
			.join("");

		const jobInfoLine = [opType, serviceMode, company, bill]
			.filter(Boolean)
			.join(" + ");
		const bodyHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:20px;">
  <p>Kính gửi <strong>${esc(opsName)}</strong>,</p>
  <p>Tổng hợp thông tin giao nhận hàng cho job <strong>${esc(jobNumber)}</strong>:</p>
  ${jobInfoLine ? `<p style="font-weight:700;color:#0369a1;font-size:16px;margin:0 0 16px;">${esc(jobInfoLine)}</p>` : ""}
  ${allVendorSections}
  <p style="margin-top:24px;">Trân trọng,</p>
</body>
</html>`;

		// SEND MAIL
		const to = opsRecord.emails.join(";");
		const cc =
			logisticsCcEmails.length > 0
				? [...new Set(logisticsCcEmails)].join(";")
				: undefined;

		const plainBody = bodyHtml;
		const htmlBodyB64 = Buffer.from(plainBody, "utf-8").toString("base64");

		const gmail = getGmailClient(accessToken);

		// Search for existing thread
		// PREFER logistics job number ONLY if available
		const logisticJobNumber = (linkedFollowUp as any)?.jobNumber;

		let threadId: string | undefined;
		let inReplyTo: string | undefined;
		let references: string | undefined;

		if (logisticJobNumber) {
			const searchQuery = `"${logisticJobNumber.trim()}"`;
			try {
				console.log(
					`[AutoMail] Searching for existing thread with query: ${searchQuery}`,
				);
				const listRes = await gmail.users.messages.list({
					userId: "me",
					q: searchQuery,
					maxResults: 1,
				});

				if (listRes.data.messages && listRes.data.messages.length > 0) {
					const lastMsg = listRes.data.messages[0];
					threadId = lastMsg.threadId || undefined;

					if (lastMsg.id) {
						const detailRes = await gmail.users.messages.get({
							userId: "me",
							id: lastMsg.id,
							format: "metadata",
							metadataHeaders: ["Message-ID", "References", "Subject"],
						});

						const headers = detailRes.data.payload?.headers;
						const msgId = headers?.find(
							(h) => h.name?.toLowerCase() === "message-id",
						)?.value;
						const refs = headers?.find(
							(h) => h.name?.toLowerCase() === "references",
						)?.value;
						const existingSubject = headers?.find(
							(h) => h.name?.toLowerCase() === "subject",
						)?.value;

						if (msgId) {
							inReplyTo = msgId;
							references = refs ? `${refs} ${msgId}` : msgId;

							// Use the existing subject to ensure thread grouping
							if (existingSubject) {
								// Decode MIME-encoded string if necessary to avoid double-encoding later
								const decodedSubject = existingSubject.replace(
									/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g,
									(match, _charset, encoding, text) => {
										try {
											if (encoding.toUpperCase() === "B") {
												return Buffer.from(text, "base64").toString("utf8");
											}
											if (encoding.toUpperCase() === "Q") {
												// Basic Q-encoded decode for standard characters
												return text
													.replace(/_/g, " ")
													.replace(/=([0-9A-F]{2})/gi, (_m: any, hex: string) =>
														String.fromCharCode(parseInt(hex, 16)),
													);
											}
											return text;
										} catch (_e) {
											return match;
										}
									},
								);

								subject = decodedSubject.toLowerCase().startsWith("re:")
									? decodedSubject
									: `Re: ${decodedSubject}`;
							}

							console.log(
								`[AutoMail] Found existing thread for job ${searchQuery}. ThreadId: ${threadId}, MessageId: ${msgId}`,
							);
						} else {
							console.log(
								`[AutoMail] Found message but no Message-ID header for query ${searchQuery}`,
							);
						}
					}
				} else {
					console.log(
						`[AutoMail] No existing thread found for query ${searchQuery}`,
					);
				}
			} catch (e) {
				console.error("Error searching for existing thread:", e);
			}
		} else {
			console.log(
				`[AutoMail] No logisticJobNumber found. Creating a new mail branch.`,
			);
		}

		const utf8Subject = `=?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
		const boundary = `vvmv_boundary_${Date.now().toString(16)}`;

		const emailContent = [
			`To: ${to}`,
			...(cc ? [`Cc: ${cc}`] : []),
			`Subject: ${utf8Subject}`,
			`From: ${userEmail}`,
			...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
			...(references ? [`References: ${references}`] : []),
			`Content-Type: multipart/mixed; boundary="${boundary}"`,
			"MIME-Version: 1.0",
			"",
			`--${boundary}`,
			"Content-Type: text/html; charset=utf-8",
			"Content-Transfer-Encoding: base64",
			"",
			...(htmlBodyB64.match(/.{1,76}/g) ?? [htmlBodyB64]),
		];

		if (driveFileIdsToAttach.length > 0) {
			const { getFileContent } = await import("@/lib/google-drive/upload");
			for (const fileId of driveFileIdsToAttach) {
				try {
					const {
						buffer,
						mimeType,
						name: fetchedName,
					} = await getFileContent(fileId);
					const fname = fetchedName || fileId;
					const encodedName = `=?utf-8?B?${Buffer.from(fname).toString("base64")}?=`;

					emailContent.push(`--${boundary}`);
					emailContent.push(`Content-Type: ${mimeType}; name="${encodedName}"`);
					emailContent.push(
						`Content-Disposition: attachment; filename="${encodedName}"`,
					);
					emailContent.push(`Content-Transfer-Encoding: base64`);
					emailContent.push("");
					const b64 = buffer.toString("base64");
					const chunks = b64.match(/.{1,76}/g) || [];
					emailContent.push(chunks.join("\r\n"));
				} catch (e: any) {
					console.error(
						`Failed to fetch and attach file ${fileId}:`,
						e.message,
					);
				}
			}
		}

		emailContent.push(`--${boundary}--`);

		const base64EncodedEmail = Buffer.from(emailContent.join("\r\n"))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

		await gmail.users.messages.send({
			userId: "me",
			requestBody: {
				raw: base64EncodedEmail,
				threadId,
			},
		});
	} catch (error) {
		console.error("Auto OPS Email Error:", error);
	}
}
