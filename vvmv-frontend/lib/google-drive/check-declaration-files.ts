import { getDriveClient } from "@/lib/google-sheets/client";

interface DeclarationFilesCheckResult {
	hasValidFiles: boolean;
	fileCount: number;
	fileNames: string[];
	missingFileTypes: string[];
	folderExists: boolean;
	error?: string;
}

/**
 * Extract folder ID from Google Drive URL
 */
function extractFolderIdFromDriveUrl(driveUrl: string): string | null {
	const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
	return match?.[1] || null;
}

/**
 * Search for a folder by name in a parent folder
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

	const files = response.data.files || [];
	if (files.length === 0) return null;

	return {
		folderId: files[0].id!,
		folderName: files[0].name!,
	};
}

/**
 * Check if "TO KHAI THONG QUAN" folder contains PDF files with "CSHT" in name
 */
export async function checkCSHTFiles(
	driveUrl: string,
): Promise<DeclarationFilesCheckResult> {
	try {
		// 1. Extract folder ID from drive URL
		const transFolderId = extractFolderIdFromDriveUrl(driveUrl);

		if (!transFolderId) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["Invalid drive URL"],
				folderExists: false,
				error: "Invalid drive URL format",
			};
		}

		// 2. Find "TO KHAI THONG QUAN" subfolder
		const declarationFolder = await searchFolder(
			"TO KHAI THONG QUAN",
			transFolderId,
		);

		if (!declarationFolder) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["TO KHAI THONG QUAN folder not found"],
				folderExists: false,
			};
		}

		// 3. List files in the folder
		const drive = getDriveClient();
		const response = await drive.files.list({
			q: `'${declarationFolder.folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id, name, mimeType)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		const files = response.data.files || [];

		// 4. Filter for PDF files containing "CSHT" or "csht" in name
		const validFiles = files.filter((f) => {
			const name = f.name || "";
			const isPdf = name.toLowerCase().endsWith(".pdf");
			const containsCSHT = name.toLowerCase().includes("csht");
			return isPdf && containsCSHT;
		});

		// 5. Check if at least one valid file exists
		const hasValidFiles = validFiles.length > 0;
		const missingFileTypes: string[] = [];

		if (!hasValidFiles) {
			missingFileTypes.push(
				'No PDF files containing "CSHT" or "csht" in name found',
			);
		}

		return {
			hasValidFiles,
			fileCount: validFiles.length,
			fileNames: validFiles.map((f) => f.name || ""),
			missingFileTypes,
			folderExists: true,
		};
	} catch (error) {
		console.error("Error checking CSHT files:", error);
		return {
			hasValidFiles: false,
			fileCount: 0,
			fileNames: [],
			missingFileTypes: ["Error checking files"],
			folderExists: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Check if "TO KHAI THONG QUAN" folder contains Excel files with "thue" in name
 */
export async function checkTAXFiles(
	driveUrl: string,
): Promise<DeclarationFilesCheckResult> {
	try {
		// 1. Extract folder ID from drive URL
		const transFolderId = extractFolderIdFromDriveUrl(driveUrl);

		if (!transFolderId) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["Invalid drive URL"],
				folderExists: false,
				error: "Invalid drive URL format",
			};
		}

		// 2. Find "TO KHAI THONG QUAN" subfolder
		const declarationFolder = await searchFolder(
			"TO KHAI THONG QUAN",
			transFolderId,
		);

		if (!declarationFolder) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["TO KHAI THONG QUAN folder not found"],
				folderExists: false,
			};
		}

		// 3. List files in the folder
		const drive = getDriveClient();
		const response = await drive.files.list({
			q: `'${declarationFolder.folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id, name, mimeType)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		const files = response.data.files || [];

		// 4. Filter for Excel files containing "thue" or "THUE" in name
		const validFiles = files.filter((f) => {
			const name = f.name || "";
			const isExcel =
				name.toLowerCase().endsWith(".xls") ||
				name.toLowerCase().endsWith(".xlsx");
			const containsThue = name.toLowerCase().includes("thue");
			return isExcel && containsThue;
		});

		// 5. Check if at least one valid file exists
		const hasValidFiles = validFiles.length > 0;
		const missingFileTypes: string[] = [];

		if (!hasValidFiles) {
			missingFileTypes.push(
				'No Excel files (.xls/.xlsx) containing "thue" or "THUE" in name found',
			);
		}

		return {
			hasValidFiles,
			fileCount: validFiles.length,
			fileNames: validFiles.map((f) => f.name || ""),
			missingFileTypes,
			folderExists: true,
		};
	} catch (error) {
		console.error("Error checking TAX files:", error);
		return {
			hasValidFiles: false,
			fileCount: 0,
			fileNames: [],
			missingFileTypes: ["Error checking files"],
			folderExists: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Check if "TO KHAI THONG QUAN" folder contains Excel files with "lphq" in name
 */
export async function checkLPHQFiles(
	driveUrl: string,
): Promise<DeclarationFilesCheckResult> {
	try {
		// 1. Extract folder ID from drive URL
		const transFolderId = extractFolderIdFromDriveUrl(driveUrl);

		if (!transFolderId) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["Invalid drive URL"],
				folderExists: false,
				error: "Invalid drive URL format",
			};
		}

		// 2. Find "TO KHAI THONG QUAN" subfolder
		const declarationFolder = await searchFolder(
			"TO KHAI THONG QUAN",
			transFolderId,
		);

		if (!declarationFolder) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["TO KHAI THONG QUAN folder not found"],
				folderExists: false,
			};
		}

		// 3. List files in the folder
		const drive = getDriveClient();
		const response = await drive.files.list({
			q: `'${declarationFolder.folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id, name, mimeType)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		const files = response.data.files || [];

		// 4. Filter for Excel files containing "lphq" or "LPHQ" in name
		const validFiles = files.filter((f) => {
			const name = f.name || "";
			const isExcel =
				name.toLowerCase().endsWith(".xls") ||
				name.toLowerCase().endsWith(".xlsx");
			const containsLPHQ = name.toLowerCase().includes("lphq");
			return isExcel && containsLPHQ;
		});

		// 5. Check if at least one valid file exists
		const hasValidFiles = validFiles.length > 0;
		const missingFileTypes: string[] = [];

		if (!hasValidFiles) {
			missingFileTypes.push(
				'No Excel files (.xls/.xlsx) containing "lphq" or "LPHQ" in name found',
			);
		}

		return {
			hasValidFiles,
			fileCount: validFiles.length,
			fileNames: validFiles.map((f) => f.name || ""),
			missingFileTypes,
			folderExists: true,
		};
	} catch (error) {
		console.error("Error checking LPHQ files:", error);
		return {
			hasValidFiles: false,
			fileCount: 0,
			fileNames: [],
			missingFileTypes: ["Error checking files"],
			folderExists: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Check if "TO KHAI THONG QUAN" folder contains Excel/PDF files
 */
export async function checkDeclarationFolderFiles(
	driveUrl: string,
): Promise<DeclarationFilesCheckResult> {
	try {
		// 1. Extract folder ID from drive URL
		const transFolderId = extractFolderIdFromDriveUrl(driveUrl);

		if (!transFolderId) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["Invalid drive URL"],
				folderExists: false,
				error: "Invalid drive URL format",
			};
		}

		// 2. Find "TO KHAI THONG QUAN" subfolder
		const declarationFolder = await searchFolder(
			"TO KHAI THONG QUAN",
			transFolderId,
		);

		if (!declarationFolder) {
			return {
				hasValidFiles: false,
				fileCount: 0,
				fileNames: [],
				missingFileTypes: ["TO KHAI THONG QUAN folder not found"],
				folderExists: false,
			};
		}

		// 3. List files in the folder
		const drive = getDriveClient();
		const response = await drive.files.list({
			q: `'${declarationFolder.folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id, name, mimeType)",
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		});

		const files = response.data.files || [];

		// 4. Filter for valid file extensions
		const validExtensions = [".xlsx", ".xls", ".pdf"];
		const validFiles = files.filter((f) => {
			const name = f.name || "";
			return validExtensions.some((ext) => name.toLowerCase().endsWith(ext));
		});

		// 5. Check if at least one valid file exists
		const hasValidFiles = validFiles.length > 0;
		const missingFileTypes: string[] = [];

		if (!hasValidFiles) {
			missingFileTypes.push("No Excel (.xlsx/.xls) or PDF (.pdf) files found");
		}

		return {
			hasValidFiles,
			fileCount: validFiles.length,
			fileNames: validFiles.map((f) => f.name || ""),
			missingFileTypes,
			folderExists: true,
		};
	} catch (error) {
		console.error("Error checking declaration files:", error);
		return {
			hasValidFiles: false,
			fileCount: 0,
			fileNames: [],
			missingFileTypes: ["Error checking files"],
			folderExists: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
