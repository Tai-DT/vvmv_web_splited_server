"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	Download,
	File as FileIcon,
	Trash2,
	Upload,
	XCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useContainerSizes } from "@/hooks/use-container-sizes";

interface ImportContainersDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	followUpId?: string; // Optional - if not provided, will use onImport callback
	onImport?: (containers: ParsedContainer[]) => void; // Callback for form-based import
}

interface ParsedContainer {
	containerNo: string;
	sealNo?: string;
	containerSize?: string;
	grossWeight?: number;
	tareWeight?: number;
	// Track original values for validation
	_rawGrossWeight?: string;
	_rawTareWeight?: string;
}

interface ValidationError {
	row: number;
	field: string;
	message: string;
}

interface ValidatedContainer extends ParsedContainer {
	isValid: boolean;
	errors: ValidationError[];
}

export function ImportContainersDialog({
	open,
	onOpenChange,
	followUpId,
	onImport,
}: ImportContainersDialogProps) {
	const queryClient = useQueryClient();
	const { containerSizes } = useContainerSizes();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [validatedContainers, setValidatedContainers] = useState<
		ValidatedContainer[]
	>([]);
	const [uploadedFile, setUploadedFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	// Helper functions for file display
	const formatFileSize = (bytes: number): string => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100}${sizes[i]}`;
	};

	const getFileExtension = (filename: string): string => {
		const ext = filename.split(".").pop()?.toLowerCase() || "";
		return ext.toUpperCase();
	};

	const getFileTypeBadgeColor = (filename: string): string => {
		const ext = filename.split(".").pop()?.toLowerCase() || "";
		if (["xls", "xlsx"].includes(ext))
			return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
		return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
	};

	const handleDownloadTemplate = () => {
		// Use real container sizes from the system, or provide generic examples if not loaded
		const exampleSize1 = containerSizes[0] || "20DC";
		const exampleSize2 = containerSizes[1] || containerSizes[0] || "40HC";

		// Create main template sheet with real container sizes
		const ws = XLSX.utils.aoa_to_sheet([
			[
				"Container No",
				"Seal No",
				"Container Size",
				"Gross Weight (kg)",
				"Tare Weight (kg)",
			],
			["MEDU1234567", "ABC123456", exampleSize1, "15000", "2200"],
			["TEMU9876543", "XYZ789012", exampleSize2, "28000", "3800"],
		]);

		// Set column widths for main sheet
		ws["!cols"] = [
			{ wch: 15 },
			{ wch: 15 },
			{ wch: 15 },
			{ wch: 20 },
			{ wch: 20 },
		];

		// Create reference sheet with all valid container sizes
		const referenceData = [
			["Valid Container Sizes"],
			["Use these values in the 'Container Size' column:"],
			[""],
			...containerSizes.map((size) => [size]),
		];

		// If no container sizes loaded, show a helpful message
		if (containerSizes.length === 0) {
			referenceData.push(
				[""],
				["Note: Container sizes will be validated when you upload."],
				["Leave blank if unknown, or contact admin for valid sizes."],
			);
		}

		const wsReference = XLSX.utils.aoa_to_sheet(referenceData);
		wsReference["!cols"] = [{ wch: 30 }];

		// Create workbook with both sheets
		const wb = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(wb, ws, "Template");
		XLSX.utils.book_append_sheet(wb, wsReference, "Valid Sizes");
		XLSX.writeFile(wb, "container_import_template.xlsx");
		toast.success("Template downloaded with valid container sizes reference");
	};

	const validateContainer = (
		container: ParsedContainer,
		rowIndex: number,
		allContainers: ParsedContainer[],
		currentIndex: number, // Add index parameter to properly identify current container
	): ValidatedContainer => {
		const errors: ValidationError[] = [];

		// Validate Container No (required)
		if (!container.containerNo || container.containerNo.trim() === "") {
			errors.push({
				row: rowIndex,
				field: "containerNo",
				message: "Container No is required",
			});
		} else {
			// Check for duplicates within the import batch (case-insensitive)
			const normalizedContainerNo = container.containerNo.trim().toUpperCase();
			const duplicates = allContainers.filter(
				(c, idx) =>
					c.containerNo?.trim().toUpperCase() === normalizedContainerNo &&
					idx !== currentIndex, // Use currentIndex instead of indexOf
			);

			if (duplicates.length > 0) {
				errors.push({
					row: rowIndex,
					field: "containerNo",
					message: "Duplicate container number in import",
				});
			}
		}

		// Validate Container Size (optional, but must be valid if provided)
		if (
			container.containerSize &&
			!containerSizes.includes(container.containerSize)
		) {
			errors.push({
				row: rowIndex,
				field: "containerSize",
				message: `Invalid container size. Must be one of: ${containerSizes.join(", ")}`,
			});
		}

		// Validate Gross Weight (optional, must be positive number)
		if (container._rawGrossWeight) {
			// User provided a value, check if it's valid
			if (container.grossWeight === undefined) {
				errors.push({
					row: rowIndex,
					field: "grossWeight",
					message: `Invalid number: "${container._rawGrossWeight}"`,
				});
			} else if (container.grossWeight < 0) {
				errors.push({
					row: rowIndex,
					field: "grossWeight",
					message: "Gross weight must be a positive number",
				});
			}
		}

		// Validate Tare Weight (optional, must be positive number)
		if (container._rawTareWeight) {
			// User provided a value, check if it's valid
			if (container.tareWeight === undefined) {
				errors.push({
					row: rowIndex,
					field: "tareWeight",
					message: `Invalid number: "${container._rawTareWeight}"`,
				});
			} else if (container.tareWeight < 0) {
				errors.push({
					row: rowIndex,
					field: "tareWeight",
					message: "Tare weight must be a positive number",
				});
			}
		}

		return {
			...container,
			isValid: errors.length === 0,
			errors,
		};
	};

	const processFile = (file: File) => {
		setUploadedFile(file);
		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const data = e.target?.result;
				const workbook = XLSX.read(data, { type: "array" });
				const sheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[sheetName];

				// Parse to JSON
				const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, {
					header: 0,
				});

				if (jsonData.length === 0) {
					toast.error("Excel file is empty");
					return;
				}

				// Map Excel columns to our fields (case-insensitive)
				const parsed: ParsedContainer[] = jsonData.map((row: any) => {
					// Find column names (case-insensitive)
					const getField = (possibleNames: string[]) => {
						for (const name of possibleNames) {
							const key = Object.keys(row).find(
								(k) => k.toLowerCase().trim() === name.toLowerCase(),
							);
							if (
								key &&
								row[key] !== undefined &&
								row[key] !== null &&
								row[key] !== ""
							) {
								return row[key];
							}
						}
						return undefined;
					};

					// Parse weight values and validate they are numbers
					const grossWeightValue = getField([
						"Gross Weight",
						"Gross Weight (kg)",
						"G.W",
						"grossWeight",
					]);
					const tareWeightValue = getField([
						"Tare Weight",
						"Tare Weight (kg)",
						"tareWeight",
					]);

					const parsedGrossWeight = grossWeightValue
						? Number(grossWeightValue)
						: undefined;
					const parsedTareWeight = tareWeightValue
						? Number(tareWeightValue)
						: undefined;

					return {
						containerNo: String(
							getField(["Container No", "Container Number", "containerNo"]) ||
								"",
						).trim(),
						sealNo: getField(["Seal No", "Seal Number", "sealNo"])
							? String(getField(["Seal No", "Seal Number", "sealNo"])).trim()
							: undefined,
						containerSize: getField(["Container Size", "Size", "containerSize"])
							? String(
									getField(["Container Size", "Size", "containerSize"]),
								).trim()
							: undefined,
						grossWeight:
							parsedGrossWeight !== undefined &&
							!Number.isNaN(parsedGrossWeight)
								? parsedGrossWeight
								: undefined,
						tareWeight:
							parsedTareWeight !== undefined && !Number.isNaN(parsedTareWeight)
								? parsedTareWeight
								: undefined,
						// Store raw values for validation
						_rawGrossWeight: grossWeightValue
							? String(grossWeightValue).trim()
							: undefined,
						_rawTareWeight: tareWeightValue
							? String(tareWeightValue).trim()
							: undefined,
					};
				});

				// Validate all containers
				const validated = parsed.map((container, index) =>
					validateContainer(container, index + 2, parsed, index),
				); // +2 because row 1 is header

				setValidatedContainers(validated);

				const validCount = validated.filter((c) => c.isValid).length;
				const invalidCount = validated.length - validCount;

				if (invalidCount > 0) {
					toast.warning(
						`Found ${validCount} valid and ${invalidCount} invalid containers`,
					);
				} else {
					toast.success(`Successfully parsed ${validCount} containers`);
				}
			} catch (error) {
				console.error("Excel parsing error:", error);
				toast.error("Failed to parse Excel file. Please check the format.");
			}
		};

		reader.onerror = () => {
			toast.error("Failed to read file");
		};

		reader.readAsArrayBuffer(file);
	};

	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		processFile(file);
	};

	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const file = e.dataTransfer.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = [
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.ms-excel",
		];
		const validExtensions = [".xlsx", ".xls"];
		const fileExtension = file.name
			.toLowerCase()
			.slice(file.name.lastIndexOf("."));

		if (
			!validTypes.includes(file.type) &&
			!validExtensions.includes(fileExtension)
		) {
			toast.error("Please upload an Excel file (.xlsx or .xls)");
			return;
		}

		processFile(file);
	};

	const handleFieldEdit = (
		index: number,
		field: keyof ParsedContainer,
		value: string,
	) => {
		setValidatedContainers((prev) => {
			const updated = [...prev];
			const container = { ...updated[index] };

			// Update the field
			if (
				field === "containerNo" ||
				field === "sealNo" ||
				field === "containerSize"
			) {
				(container as any)[field] = value.trim() || undefined;
			} else if (field === "grossWeight" || field === "tareWeight") {
				const numValue = value.trim() ? Number(value) : undefined;
				container[field] =
					numValue !== undefined && !Number.isNaN(numValue)
						? numValue
						: undefined;
				// Update raw value for validation
				const rawField =
					field === "grossWeight" ? "_rawGrossWeight" : "_rawTareWeight";
				container[rawField] = value.trim() || undefined;
			}

			// Update the container in the array
			updated[index] = container;

			// Re-validate ALL containers (important for duplicate detection)
			const cleanContainers = updated.map(
				({ isValid, errors, ...rest }) => rest,
			);
			const revalidated = updated.map((c, i) =>
				validateContainer(c, i + 2, cleanContainers, i),
			);

			return revalidated;
		});
	};

	const handleImport = async () => {
		const validContainers = validatedContainers.filter((c) => c.isValid);

		if (validContainers.length === 0) {
			toast.error("No valid containers to import");
			return;
		}

		setIsLoading(true);
		try {
			// If onImport callback is provided, use it (form-based import)
			if (onImport) {
				// Remove internal fields before passing to callback
				const cleanedContainers = validContainers.map((c) => {
					const { _rawGrossWeight, _rawTareWeight, ...rest } = c;
					return rest;
				});
				onImport(cleanedContainers);
				toast.success(
					`Imported ${validContainers.length} container${validContainers.length > 1 ? "s" : ""} to form`,
				);

				// Reset and close
				setValidatedContainers([]);
				setUploadedFile(null);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
				onOpenChange(false);
				setIsLoading(false);
				return;
			}

			// Otherwise, create containers in database (requires followUpId)
			if (!followUpId) {
				toast.error("Follow-up ID is required for database import");
				setIsLoading(false);
				return;
			}

			// Create all containers and track failures
			const results = await Promise.all(
				validContainers.map(async (container) => {
					const response = await fetch("/api/followup/create-container", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							followUpId,
							containerNo: container.containerNo,
							sealNo: container.sealNo || null,
							containerSize: container.containerSize || null,
							quantity: 1, // Default quantity is 1
							grossWeight: container.grossWeight ?? null,
							tareWeight: container.tareWeight ?? null,
						}),
					});

					const data = await response.json().catch(() => ({}));
					return { response, container, error: data.message };
				}),
			);

			const failed = results.filter((r) => !r.response.ok);
			const successCount = results.length - failed.length;

			// Refresh data
			await queryClient.invalidateQueries({ queryKey: ["followups"] });

			if (failed.length > 0) {
				// Show specific error messages for duplicates
				const duplicateErrors = failed.filter((f) =>
					f.error?.includes("đã tồn tại"),
				);
				const otherErrors = failed.filter(
					(f) => !f.error?.includes("đã tồn tại"),
				);

				if (duplicateErrors.length > 0) {
					const duplicateNos = duplicateErrors
						.map((f) => f.container.containerNo)
						.join(", ");
					toast.error(
						`${duplicateErrors.length} container(s) already exist: ${duplicateNos}`,
					);
				}

				if (otherErrors.length > 0) {
					toast.warning(
						`${successCount} container(s) imported, ${otherErrors.length} failed`,
					);
				}

				if (successCount > 0) {
					toast.success(`${successCount} container(s) imported successfully`);
				}
			} else {
				toast.success(
					`${successCount} container${successCount > 1 ? "s" : ""} imported successfully`,
				);
			}

			// Reset and close
			setValidatedContainers([]);
			setUploadedFile(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to import containers",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setValidatedContainers([]);
		setUploadedFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
		onOpenChange(false);
	};

	const validCount = validatedContainers.filter((c) => c.isValid).length;
	const invalidCount = validatedContainers.length - validCount;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Import Containers from Excel</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Download Template */}
					<div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<Download className="size-5 text-blue-600 dark:text-blue-400 mt-0.5" />
							<div className="flex-1">
								<h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
									Download Template
								</h4>
								<p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
									Download the Excel template with the correct format and column
									names
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleDownloadTemplate}
									className="gap-2"
								>
									<Download className="size-4" />
									Download Template
								</Button>
							</div>
						</div>
					</div>

					{/* Upload File */}
					<button
						type="button"
						className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors w-full cursor-pointer ${
							isDragging
								? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
								: "border-border hover:border-blue-400 hover:bg-muted/50"
						}`}
						onDragEnter={handleDragEnter}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						onClick={() => fileInputRef.current?.click()}
					>
						<Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
						<div className="mb-4">
							<p className="text-sm font-medium mb-1">Upload Excel File</p>
							<p className="text-xs text-muted-foreground">
								Drag and drop or click to browse
							</p>
							<p className="text-xs text-muted-foreground">
								Supports .xlsx, .xls files
							</p>
						</div>
						<input
							ref={fileInputRef}
							type="file"
							accept=".xlsx,.xls"
							onChange={handleFileUpload}
							className="hidden"
							id="excel-upload"
						/>
						<span className="inline-flex items-center gap-2 px-4 py-2 border rounded-md bg-background text-sm font-medium">
							<Upload className="size-4" />
							Choose File
						</span>
					</button>

					{/* Uploaded File Display */}
					{uploadedFile && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold">Uploaded File</h3>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										setUploadedFile(null);
										setValidatedContainers([]);
										if (fileInputRef.current) {
											fileInputRef.current.value = "";
										}
									}}
									className="gap-1 text-destructive hover:text-destructive"
								>
									<Trash2 className="size-4" />
									Remove
								</Button>
							</div>

							<div className="rounded-lg border overflow-hidden">
								<table className="w-full table-fixed">
									<thead>
										<tr className="border-b bg-muted/50">
											<th className="p-3 text-left text-sm font-medium text-muted-foreground">
												Name
											</th>
											<th className="p-3 text-left text-sm font-medium text-muted-foreground w-24">
												Type
											</th>
											<th className="p-3 text-left text-sm font-medium text-muted-foreground w-28">
												Size
											</th>
										</tr>
									</thead>
									<tbody>
										<tr className="hover:bg-muted/30 transition-colors">
											<td className="p-3">
												<div className="flex items-center gap-2 min-w-0">
													<FileIcon className="size-4 text-muted-foreground flex-shrink-0" />
													<span
														className="text-sm truncate"
														title={uploadedFile.name}
													>
														{uploadedFile.name}
													</span>
												</div>
											</td>
											<td className="p-3 w-24">
												<span
													className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${getFileTypeBadgeColor(uploadedFile.name)}`}
												>
													{getFileExtension(uploadedFile.name)}
												</span>
											</td>
											<td className="p-3 text-sm text-muted-foreground w-28 whitespace-nowrap">
												{formatFileSize(uploadedFile.size)}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					)}

					{/* Validation Results */}
					{validatedContainers.length > 0 && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-medium">Validation Results</h4>
								<div className="flex items-center gap-4 text-xs">
									<span className="flex items-center gap-1 text-green-600 dark:text-green-400">
										<CheckCircle2 className="size-3.5" />
										{validCount} valid
									</span>
									{invalidCount > 0 && (
										<span className="flex items-center gap-1 text-red-600 dark:text-red-400">
											<XCircle className="size-3.5" />
											{invalidCount} invalid
										</span>
									)}
								</div>
							</div>

							<div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
								<table className="w-full text-xs">
									<thead className="bg-muted sticky top-0">
										<tr>
											<th className="text-left py-2 px-1.5 font-medium w-4">
												#
											</th>
											<th className="text-left py-2 px-1.5 font-medium w-8">
												Container
											</th>
											<th className="text-left py-2 px-1.5 font-medium">
												Seal
											</th>
											<th className="text-left py-2 px-1.5 font-medium">
												Size
											</th>
											<th className="text-left py-2 px-1.5 font-medium">G.W</th>
											<th className="text-left py-2 px-1.5 font-medium">
												Tare
											</th>
											<th className="text-left py-2 px-1.5 font-medium">
												Errors
											</th>
										</tr>
									</thead>
									<tbody className="divide-y">
										{validatedContainers.map((container, index) => (
											<tr
												key={index}
												className={
													container.isValid
														? ""
														: "bg-red-50 dark:bg-red-950/10"
												}
											>
												<td className="py-1.5 px-1.5 text-muted-foreground">
													{index + 1}
												</td>
												<td className="py-1.5 px-1.5">
													<input
														type="text"
														value={container.containerNo || ""}
														onChange={(e) =>
															handleFieldEdit(
																index,
																"containerNo",
																e.target.value,
															)
														}
														className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
														placeholder="Enter container no"
													/>
												</td>
												<td className="py-1.5 px-1.5">
													<input
														type="text"
														value={container.sealNo || ""}
														onChange={(e) =>
															handleFieldEdit(index, "sealNo", e.target.value)
														}
														className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
														placeholder="Enter seal no"
													/>
												</td>
												<td className="py-1.5 px-1.5">
													<select
														value={container.containerSize || ""}
														onChange={(e) =>
															handleFieldEdit(
																index,
																"containerSize",
																e.target.value,
															)
														}
														className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
													>
														<option value="">Select</option>
														{containerSizes.map((size) => (
															<option key={size} value={size}>
																{size}
															</option>
														))}
													</select>
												</td>
												<td className="py-1.5 px-1.5">
													<input
														type="text"
														value={
															container._rawGrossWeight ||
															container.grossWeight?.toString() ||
															""
														}
														onChange={(e) =>
															handleFieldEdit(
																index,
																"grossWeight",
																e.target.value,
															)
														}
														className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background tabular-nums"
														placeholder="Weight"
													/>
												</td>
												<td className="py-1.5 px-1.5">
													<input
														type="text"
														value={
															container._rawTareWeight ||
															container.tareWeight?.toString() ||
															""
														}
														onChange={(e) =>
															handleFieldEdit(
																index,
																"tareWeight",
																e.target.value,
															)
														}
														className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background tabular-nums"
														placeholder="Weight"
													/>
												</td>
												<td className="py-1.5 px-1.5">
													{container.errors.length > 0 ? (
														<div className="space-y-1">
															{container.errors.map((error, errIdx) => (
																<div
																	key={errIdx}
																	className="flex items-start gap-1 text-red-600 dark:text-red-400"
																>
																	<AlertCircle className="size-3 mt-0.5 shrink-0" />
																	<span className="text-[10px]">
																		{error.message}
																	</span>
																</div>
															))}
														</div>
													) : (
														<span className="text-muted-foreground">—</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{invalidCount > 0 && (
								<div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
									<div className="flex items-start gap-2">
										<AlertCircle className="size-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
										<div className="text-xs text-yellow-800 dark:text-yellow-200">
											<p className="font-medium mb-1">
												Invalid rows will be skipped
											</p>
											<p className="text-yellow-700 dark:text-yellow-300">
												Only {validCount} valid container
												{validCount !== 1 ? "s" : ""} will be imported. Please
												fix errors in the Excel file and re-upload if needed.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="pt-4">
					<Button variant="outline" onClick={handleClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button
						onClick={handleImport}
						disabled={isLoading || validCount === 0}
					>
						{isLoading
							? "Importing..."
							: `Import ${validCount} Container${validCount !== 1 ? "s" : ""}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
