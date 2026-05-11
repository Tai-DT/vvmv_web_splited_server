import { Readable } from "node:stream";
import type { drive_v3 } from "googleapis";
import { getDriveClient } from "../google-sheets/client";

/**
 * Get all Shared Drives that the service account has access to
 * @returns Array of Shared Drive objects with id and name
 */
async function getAllSharedDrives(): Promise<
	Array<{ id: string; name: string }>
> {
	const drive = getDriveClient();

	try {
		const response = await drive.drives.list({
			pageSize: 100,
			fields: "drives(id, name)",
		});

		const drives = response.data.drives || [];
		return drives
			.filter((d) => d.id && d.name)
			.map((d) => ({ id: d.id!, name: d.name! }));
	} catch (error) {
		console.error("Error listing Shared Drives:", error);
		return [];
	}
}

/**
 * Search for a folder by name recursively in a Shared Drive
 * @param folderName - Name of folder to search for
 * @param driveId - Shared Drive ID
 * @returns Object with folder ID and actual name if found, null otherwise
 */
async function searchFolderInSharedDrive(
	folderName: string,
	driveId: string,
	targetYear?: number,
): Promise<{ folderId: string; folderName: string } | null> {
	const drive = getDriveClient();

	try {
		// Search across all folders in this Shared Drive (recursive, using contains for partial match)
		const response = await drive.files.list({
			q: `name contains '${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
			driveId: driveId,
			corpora: "drive",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
			fields: "files(id, name, parents)",
		});

		const folders = response.data.files || [];

		// Prioritize folders that contain the target year in their name
		if (targetYear && folders.length > 1) {
			folders.sort((a, b) => {
				const aHasYear = a.name?.includes(String(targetYear)) ? 1 : 0;
				const bHasYear = b.name?.includes(String(targetYear)) ? 1 : 0;
				return bHasYear - aHasYear;
			});
		}

		for (const folder of folders) {
			if (folder.name && !folder.name.includes(`${folderName}-`)) {
				return {
					folderId: folder.id || "",
					folderName: folder.name || folderName,
				};
			}
		}
	} catch (error) {
		console.error(`Error searching in Shared Drive ${driveId}:`, error);
	}

	return null;
}

/**
 * Search for a folder by name across ALL Shared Drives recursively
 * @param folderName - Name of folder to search for
 * @returns Object with folder ID, actual folder name, and drive name if found, null otherwise
 */
export async function searchFolderInAllSharedDrives(
	folderName: string,
	transID: string,
	shmtDate?: Date | null,
): Promise<{ folderId: string; folderName: string; driveName: string } | null> {
	const targetYear =
		shmtDate && !Number.isNaN(shmtDate.getTime())
			? shmtDate.getFullYear()
			: new Date().getFullYear();

	const sharedDrives = await getAllSharedDrives();

	if (sharedDrives.length === 0) {
		console.warn("No Shared Drives found");
		return null;
	}

	const excludedDriveNames = ["LOGSGN ACTIVITIES"];
	const teamBases = [
		"TEAM_AVERY",
		"TEAM_CO",
		"TEAM_DIENTU",
		"TEAM_DIEUPHOI",
		"TEAM_FAR",
		"TEAM_KCN",
		"TEAM_MACHINE",
		"TEAM_MAYMAC",
		"TEAM_THUCPHAM",
		"TEAM_TONGHOP",
	];

	let includedDriveNames = [];
	// Search in all Shared Drives concurrently
	if (transID.includes("HCM") || transID.includes("SGN")) {
		// Generate drive names for current target year
		includedDriveNames = teamBases.map((base) => `${base}_${targetYear}`);

		// Also include some special ones or just the bases?
		// For safety, let's include the hardcoded ones from before too and some variations
		const legacyHardcoded = ["TEAM_HANGDAILY"];
		includedDriveNames = [
			...new Set([...includedDriveNames, ...legacyHardcoded]),
		];
	} else {
		includedDriveNames = ["LOGHN1", "LOG_THANGLONG"];
	}

	// Sort sharedDrives to prioritize those matching includedDriveNames AND targetYear
	const sortedDrives = [...sharedDrives].sort((a, b) => {
		const aMatch = includedDriveNames.includes(a.name) ? 1 : 0;
		const bMatch = includedDriveNames.includes(b.name) ? 1 : 0;

		if (aMatch !== bMatch) return bMatch - aMatch;

		// If both match or neither, prioritize targetYear in name
		const aHasYear = a.name.includes(String(targetYear)) ? 1 : 0;
		const bHasYear = b.name.includes(String(targetYear)) ? 1 : 0;
		return bHasYear - aHasYear;
	});

	for (const drive of sortedDrives) {
		// Broaden matching: search in drives that belong to teams even if year is different
		const isRelevantTeam =
			transID.includes("HCM") || transID.includes("SGN")
				? includedDriveNames.some((base) => drive.name.startsWith(base))
				: includedDriveNames.includes(drive.name);

		if (!excludedDriveNames.includes(drive.name) && isRelevantTeam) {
			const result = await searchFolderInSharedDrive(
				folderName,
				drive.id,
				targetYear,
			);
			if (result && !result.folderName.includes(`${folderName}-`)) {
				return {
					folderId: result.folderId,
					folderName: result.folderName,
					driveName: drive.name,
				};
			}
		}
	}
	return null;
}

/**
 * Search for a folder by name in a parent folder (within Shared Drive)
 * @param folderName - Name of folder to search for
 * @param parentId - Parent folder ID
 * @returns Object with folder ID and actual name if found, null otherwise
 */
async function searchFolder(
	folderName: string,
	parentId: string,
): Promise<{ folderId: string; folderName: string } | null> {
	const drive = getDriveClient();

	const response = await drive.files.list({
		q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
		fields: "files(id, name)",
		includeItemsFromAllDrives: true,
		supportsAllDrives: true,
	});

	const folders = response.data.files || [];
	if (folders.length > 0 && folders[0].id) {
		return {
			folderId: folders[0].id,
			folderName: folders[0].name || folderName,
		};
	}
	return null;
}

/**
 * Create a new folder in Google Drive (Shared Drive compatible)
 * @param folderName - Name of the folder to create
 * @param parentId - Parent folder ID
 * @returns Created folder ID
 */
async function createFolder(
	folderName: string,
	parentId: string,
): Promise<string> {
	const drive = getDriveClient();

	const fileMetadata: drive_v3.Schema$File = {
		name: folderName,
		mimeType: "application/vnd.google-apps.folder",
		parents: [parentId],
	};

	const response = await drive.files.create({
		requestBody: fileMetadata,
		fields: "id",
		supportsAllDrives: true,
	});

	if (!response.data.id) {
		throw new Error(`Failed to create folder: ${folderName}`);
	}

	return response.data.id;
}

/**
 * Get or create a folder (search first, create if not found)
 * @param folderName - Name of the folder
 * @param parentId - Parent folder ID
 * @returns Object with folder ID and actual name
 */
async function getOrCreateFolder(
	folderName: string,
	parentId: string,
): Promise<{ folderId: string; folderName: string }> {
	const existing = await searchFolder(folderName, parentId);
	if (existing) {
		return existing;
	}
	const createdId = await createFolder(folderName, parentId);
	return { folderId: createdId, folderName };
}

/**
 * Get month name in Vietnamese format (e.g., "THANG 11") from a date
 * @param date - Optional date, defaults to current date if not provided
 */
function getMonthFolder(date?: Date | null): string {
	const targetDate = date && !Number.isNaN(date.getTime()) ? date : new Date();
	const month = targetDate.getMonth() + 1; // getMonth() returns 0-11
	return `THANG ${month}`;
}

/**
 * Upload a file to Google Drive (Shared Drive compatible)
 * @param file - File buffer
 * @param fileName - Original file name
 * @param mimeType - File MIME type
 * @param parentId - Parent folder ID
 * @returns Uploaded file ID
 */
async function uploadFile(
	file: Buffer,
	fileName: string,
	mimeType: string,
	parentId: string,
): Promise<string> {
	const drive = getDriveClient();

	// Convert Buffer to Readable stream
	const stream = Readable.from(file);

	const fileMetadata: drive_v3.Schema$File = {
		name: fileName,
		parents: [parentId],
	};

	const media = {
		mimeType,
		body: stream,
	};

	const response = await drive.files.create({
		requestBody: fileMetadata,
		media: media,
		fields: "id",
		supportsAllDrives: true,
	});

	if (!response.data.id) {
		throw new Error(`Failed to upload file: ${fileName}`);
	}

	return response.data.id;
}

/**
 * Get shareable link for a folder
 * @param folderId - Folder ID
 * @returns Shareable Drive URL
 */
async function getFolderUrl(folderId: string): Promise<string> {
	return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Upload files to organized Google Drive folder structure
 *
 * Folder structure:
 * [CustomerCode]/THANG [Month]/[XUAT|NHAP]/[TransID]/
 *   ├── files...
 *   ├── TO KHAI THONG QUAN/ (empty folder for declarations)
 *   └── TRUCKING/ (empty folder for trucking)
 *
 * @param files - Array of files to upload
 * @param customerCode - Customer tax code or ID
 * @param operationType - "XUAT" or "NHAP"
 * @param transID - Transaction ID from ERP
 * @returns Drive folder URL, file count, folder path, and local Windows path
 */
export async function uploadFilesToDrive(
	files: Array<{ buffer: Buffer; filename: string; mimetype: string }>,
	customerCode: string,
	operationType: string,
	transID: string,
	shmtDate?: Date | null,
): Promise<{
	driveUrl: string;
	fileCount: number;
	folderPath: string;
	localPath: string;
}> {
	try {
		// Step 1: Search for customer folder recursively across ALL Shared Drives
		const searchResult = await searchFolderInAllSharedDrives(
			customerCode,
			transID,
		);

		if (!searchResult) {
			throw new Error(
				`Customer folder '${customerCode}' not found in any Shared Drive. Please create it first.`,
			);
		}

		const {
			folderId: customerFolderId,
			folderName: actualCustomerName,
			driveName,
		} = searchResult;

		// Step 2: Get or create THANG folder
		const monthFolderName = getMonthFolder(shmtDate);
		const monthFolder = await getOrCreateFolder(
			monthFolderName,
			customerFolderId,
		);

		// Step 3: Get or create operation type folder (XUAT or NHAP)
		const operationFolder = await getOrCreateFolder(
			operationType,
			monthFolder.folderId,
		);

		// Step 4: Create TransID folder
		const transFolderId = await createFolder(transID, operationFolder.folderId);

		// Step 5: Create "TO KHAI THONG QUAN" and "TRUCKING" empty folders inside TransID folder
		const _declarationFolderId = await createFolder(
			"TO KHAI THONG QUAN",
			transFolderId,
		);
		const _truckingFolderId = await createFolder("TRUCKING", transFolderId);

		// Step 6: Upload all files to TransID folder (not inside TO KHAI THONG QUAN)
		if (files && files.length > 0) {
			const uploadPromises = files.map((file) =>
				uploadFile(file.buffer, file.filename, file.mimetype, transFolderId),
			);

			await Promise.all(uploadPromises);
		}

		// Step 7: Get shareable URL
		const driveUrl = await getFolderUrl(transFolderId);
		const folderPath = await generateFolderPathFromHierarchy(
			transFolderId,
			driveName,
		);

		// Step 8: Generate local path in Windows format using actual folder names
		const localPath = `G:\\Shared drives\\${driveName}\\${folderPath}`;

		return {
			driveUrl,
			fileCount: files.length,
			folderPath,
			localPath,
		};
	} catch (error) {
		console.error("Error uploading files to Drive:", error);
		throw error;
	}
}

/**
 * Get folder path by traversing up the folder hierarchy
 * @param folderId - Starting folder ID
 * @returns Array of folder names from root to the folder
 */
async function getFolderPathFromId(
	folderId: string,
): Promise<Array<{ id: string; name: string }>> {
	const drive = getDriveClient();
	const path = [];
	let currentId = folderId;

	while (currentId) {
		try {
			const response = await drive.files.get({
				fileId: currentId,
				fields: "id, name, parents, driveId",
				supportsAllDrives: true,
			});

			const file = response.data;
			path.unshift({
				id: currentId,
				name: file.name || "Unknown",
			});

			// Check if this is the root of a Shared Drive
			if (file.driveId && file.id === file.driveId) {
				// This is the Shared Drive root
				break;
			}

			// Move to parent
			if (file.parents && file.parents.length > 0) {
				currentId = file.parents[0];
			} else {
				// No more parents
				break;
			}
		} catch (error) {
			console.error(`Error getting folder info for ${currentId}:`, error);
			break;
		}
	}

	return path;
}

/**
 * Generate display folder path (without drive letter)
 * @param transFolderId - Transaction folder ID
 * @returns Folder path for display
 */
async function generateFolderPathFromHierarchy(
	transFolderId: string,
	driveName: string,
): Promise<string> {
	const path = await getFolderPathFromId(transFolderId);

	// Remove the Shared Drive root from path if it's included
	let pathSegments = path;
	if (path[0].name === driveName || path[0].name === "Drive") {
		pathSegments = path.slice(1);
	}

	return pathSegments.map((folder) => folder.name).join("\\");
}

/**
 * List files in a Google Drive folder
 * @param folderId - Folder ID
 * @returns Array of file objects with id, name, mimeType, and size
 */
export async function listFiles(
	folderId: string,
): Promise<
	Array<{ id: string; name: string; mimeType: string; size?: string | null }>
> {
	const drive = getDriveClient();

	try {
		const response = await drive.files.list({
			q: `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
			fields: "files(id, name, mimeType, size)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		const files = response.data.files || [];
		return files.flatMap((file) => {
			if (!file.id || !file.name || !file.mimeType) {
				return [];
			}

			return [
				{
					id: file.id,
					name: file.name,
					mimeType: file.mimeType,
					size: file.size ?? null,
				},
			];
		});
	} catch (error) {
		console.error("Error listing files in folder:", error);
		throw error;
	}
}

/**
 * Get file content from Google Drive as a Buffer
 * @param fileId - File ID
 * @returns Object with buffer and mimeType
 */
export async function getFileContent(fileId: string): Promise<{
	buffer: Buffer;
	mimeType: string;
	name: string;
}> {
	const drive = getDriveClient();

	try {
		const fileMetadata = await drive.files.get({
			fileId: fileId,
			fields: "mimeType, name",
			supportsAllDrives: true,
		});

		const fileMime = fileMetadata.data.mimeType || "";
		const fileName = fileMetadata.data.name || "file";

		// 1. If it's a native Google Docs/Sheets/Slides file, we must "export" it to a standard PDF format
		if (fileMime.startsWith("application/vnd.google-apps.")) {
			const exportResponse = await drive.files.export(
				{
					fileId: fileId,
					mimeType: "application/pdf",
				},
				{ responseType: "arraybuffer" },
			);
			return {
				buffer: Buffer.from(exportResponse.data as ArrayBuffer),
				mimeType: "application/pdf",
				name: `${fileName}.pdf`,
			};
		}

		// 2. Special case: Old binary Word .doc (legacy) files
		// These cannot be parsed by mammoth or Gemini directly, so we convert them
		// to PDF on the fly via Google Drive's internal conversion.
		if (
			fileMime === "application/msword" ||
			fileName.toLowerCase().endsWith(".doc")
		) {
			let tempId: string | undefined;
			try {
				// Copy and transform to Google Doc format
				const tempDoc = await drive.files.copy({
					fileId: fileId,
					requestBody: {
						mimeType: "application/vnd.google-apps.document",
						name: `[AI_TEMP]_${fileName}`,
					},
					supportsAllDrives: true,
				});
				tempId = tempDoc.data.id!;

				const exportResponse = await drive.files.export(
					{
						fileId: tempId,
						mimeType: "application/pdf",
					},
					{ responseType: "arraybuffer" },
				);
				return {
					buffer: Buffer.from(exportResponse.data as ArrayBuffer),
					mimeType: "application/pdf",
					name: `${fileName}.pdf`,
				};
			} finally {
				if (tempId) {
					await drive.files
						.delete({ fileId: tempId, supportsAllDrives: true })
						.catch(console.error);
				}
			}
		}

		// 3. Binary files (like .pdf or .png) or new .docx can be downloaded directly
		const response = await drive.files.get(
			{ fileId: fileId, alt: "media", supportsAllDrives: true },
			{ responseType: "arraybuffer" },
		);

		return {
			buffer: Buffer.from(response.data as ArrayBuffer),
			mimeType: fileMime || "application/octet-stream",
			name: fileName,
		};
	} catch (error) {
		console.error("Error downloading file content:", error);
		throw error;
	}
}
