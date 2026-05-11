"use client";

import type { Column, ColumnDef } from "@tanstack/react-table";
import { BulkSelectionHeader } from "@/components/shared/data-table";
import {
	TRUCKING_BOT_ACTIONS,
	TRUCKING_BULK_ACTIONS,
} from "@/lib/validation/trucking-followup-validation";
import type { ComboboxOption } from "../../../followup/_components/cells/combobox-cell";
import { SortableHeader } from "../../../followup/_components/table/sortable-header";
import type { ContainerRow } from "../../../followup/types";
import type { TruckingFollowUpRow } from "../../types";
import { TRUCKING_FOLLOWUP_HEADERS } from "./column-headers";

export const getTruckingColumns = (
	_serviceModes: string[] = [],
	_siteUsers: ComboboxOption[] = [],
	_vendors: ComboboxOption[] = [],
	_pickOrLiftPlaces: ComboboxOption[] = [],
	_ops: ComboboxOption[] = [],
): ColumnDef<TruckingFollowUpRow>[] => {
	// Define trucking-specific bot actions
	const TRUCKING_ACTIONS_LIST = [
		TRUCKING_BOT_ACTIONS.TRUCKING_INPUT,
		TRUCKING_BOT_ACTIONS.POD_MAKING,
		TRUCKING_BOT_ACTIONS.EPORT_DECLARATION,
		TRUCKING_BULK_ACTIONS.COMBINE_JOB,
		TRUCKING_BOT_ACTIONS.FAST_UNFINISH,
	] as const;

	return Object.keys(TRUCKING_FOLLOWUP_HEADERS).reduce<
		ColumnDef<TruckingFollowUpRow>[]
	>((acc, key) => {
		const config =
			TRUCKING_FOLLOWUP_HEADERS[key as keyof typeof TRUCKING_FOLLOWUP_HEADERS];

		if (!config || config.hidden) return acc;

		const columnDef: any = {
			id: key,
			header:
				key === "actions"
					? ({ table }: { table: any }) => (
							<BulkSelectionHeader
								table={table}
								actions={TRUCKING_ACTIONS_LIST}
							/>
						)
					: ({ column }: { column: Column<TruckingFollowUpRow, any> }) => (
							<SortableHeader column={column as any}>
								{config.header}
							</SortableHeader>
						),
			size: config.size || 150,
			minSize: config.minSize || 100,
			maxSize: config.maxSize || 1000,
			enableResizing: config.enableResizing ?? true,
			enableSorting: config.enableSorting ?? true,
			enableHiding: config.enableHiding ?? true,
			enablePinning: config.enablePinning ?? true,
			accessorKey:
				key !== "actions" && key !== "documents" && key !== "logJobs"
					? key
					: undefined,
			meta: {
				isPermanentlyPinned: config.isPermanentlyPinned,
			},
		};

		// Handle vendor column - always aggregate from FCRs (source of truth)
		if (key === "vendor") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.vendor)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				if (uniqueValues.length === 0) return "";
				return uniqueValues.join("\n");
			};
		}

		// Handle ops column - always aggregate from FCRs (source of truth)
		if (key === "ops") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs.map((f) => f.ops).filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				if (uniqueValues.length === 0) return "";
				return uniqueValues.join("\n");
			};
		}

		// Handle bienBanBT column - aggregate from FCRs (true if any FCR has it)
		if (key === "bienBanBT") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				if (fcrs.length === 0) return row.bienBanBT ?? false;
				return fcrs.some((f) => f.bienBanBT === true);
			};
		}

		// Handle warehouse column - always aggregate from FCRs (source of truth)
		if (key === "warehouse") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.warehouse)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				if (uniqueValues.length === 0) return "";
				return uniqueValues.join("\n");
			};
		}

		// Handle implementationDate column - always aggregate from FCRs (source of truth)
		if (key === "implementationDate") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];

				const values = fcrs
					.map((f) => f.implementationDate)
					.filter((d): d is string => !!d);

				if (values.length === 0) return "";

				// Helper to format date for comparison and display
				const format = (d: string) => {
					const date = new Date(d);
					if (Number.isNaN(date.getTime())) return "";
					const day = String(date.getUTCDate()).padStart(2, "0");
					const month = String(date.getUTCMonth() + 1).padStart(2, "0");
					const year = date.getUTCFullYear();
					return `${day}/${month}/${year}`;
				};

				const displayValues = [...new Set(values.map(format))].filter(Boolean);
				if (displayValues.length <= 1) {
					// All same or only one actual value, return the ISO string for DateCell
					return values[0];
				}
				// Different dates, return joined formatted strings
				return displayValues.join("\n");
			};
		}

		// Handle fromLocation, toLocation, truckType columns - aggregate from FCRs
		if (key === "fromLocation") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.pickupAt)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				return uniqueValues.join("\n");
			};
		}

		if (key === "toLocation") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.deliveryAt)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				return uniqueValues.join("\n");
			};
		}

		// Handle truckType column - always aggregate from FCRs (source of truth)
		if (key === "truckType") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.truckType)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				if (uniqueValues.length === 0) return "";
				return uniqueValues.join("\n");
			};
		}

		// Handle tTypeC column - always aggregate from FCRs (source of truth)
		if (key === "tTypeC") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.tTypeC)
					.filter((v): v is string => !!v);
				const uniqueValues = [...new Set(values)];
				if (uniqueValues.length === 0) return "";
				return uniqueValues.join("\n");
			};
		}

		// fcrVehicleInfo — one value per FCR (vendor-filled), joined by newline
		if (key === "fcrVehicleInfo") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.vehicleInfo)
					.filter((v): v is string => !!v);
				return values.join("\n");
			};
		}

		// fcrPlateNumbers — unique plate numbers from all FCRs, each as a badge (read-only)
		if (key === "fcrPlateNumbers") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => f.plateNumber)
					.filter((v): v is string => !!v);
				const unique = [...new Set(values)];
				return unique.join("\n");
			};
		}

		if (key === "note5") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				if (row.note5) return row.note5;
				const fcrs = row.fcrs || [];
				const values = fcrs
					.map((f) => {
						const parts = [];
						const driverStr = f.truckingNumber?.driverName || f.driver;
						if (driverStr) parts.push(driverStr);

						const plateStr = f.truckingNumber?.plateNumber || f.plateNumber;
						if (plateStr) parts.push(`BSX:${plateStr}`);

						if (f.truckingNumber?.driverPhone)
							parts.push(`ĐT:${f.truckingNumber.driverPhone}`);
						if (f.truckingNumber?.driverCCCD)
							parts.push(`CCCD: ${f.truckingNumber.driverCCCD}`);
						if (f.truckingNumber?.driverLicense)
							parts.push(`GPLX: ${f.truckingNumber.driverLicense}`);

						return parts.length > 0 ? parts.join(", ") : null;
					})
					.filter((v): v is string => !!v);
				const unique = [...new Set(values)];
				return unique.join("\n");
			};
		}

		// Handle container-sourced fields — aggregate from containers when present
		const CONTAINER_FIELD_MAP: Record<string, keyof ContainerRow> = {
			cutOffTime: "cutOffTime",
			closingTime: "closingTime",
			vesselName: "vesselName",
			veselNumber: "veselNumber",
			pickOrLiftPlace: "pickOrLiftPlace",
			maLo: "maLo",
			invoiceTaxCode: "vatTaxCode",
		};

		if (key in CONTAINER_FIELD_MAP) {
			const containerField = CONTAINER_FIELD_MAP[key];
			const isDatetime = key === "cutOffTime";
			const isDate = key === "closingTime";

			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const containers = row.containers || [];
				if (containers.length === 0) return "";

				const format = (val: string | null | undefined) => {
					if (!val) return null;
					const date = new Date(val);
					if (Number.isNaN(date.getTime())) return null;
					if (isDatetime) {
						return (
							date.toLocaleDateString("vi-VN") +
							" " +
							date.toLocaleTimeString("vi-VN", {
								hour: "2-digit",
								minute: "2-digit",
							})
						);
					}
					if (isDate) return date.toLocaleDateString("vi-VN");
					return val;
				};

				const rawValues = containers
					.map((c) => c[containerField] as string | null | undefined)
					.filter(Boolean) as string[];

				if (rawValues.length === 0) return "";

				if (isDatetime || isDate) {
					const uniqueRaw = [...new Set(rawValues)];
					// Single value: return raw ISO so DateCell can parse and display correctly
					if (uniqueRaw.length === 1) return uniqueRaw[0];
					// Multiple distinct values: return formatted strings joined with \n
					const formatted = [...new Set(rawValues.map(format))].filter(
						Boolean,
					) as string[];
					return formatted.join("\n");
				}

				const unique = [...new Set(rawValues)];
				return unique.join("\n");
			};
		}

		if (key === "documents") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				// Priority: Direct trucking documents > Linked logistics documents
				return {
					driveUrl: row.driveUrl || row.followUps?.[0]?.driveUrl,
					localPath: row.localPath || row.followUps?.[0]?.localPath,
				};
			};
			columnDef.filterFn = (
				row: { original: TruckingFollowUpRow },
				_columnId: string,
				filterValue: any,
			) => {
				const firstFollowUp = row.original.followUps?.[0];
				const driveUrl = firstFollowUp?.driveUrl || "";
				const localPath = firstFollowUp?.localPath || "";
				const searchValue = String(filterValue).toLowerCase();
				return (
					driveUrl.toLowerCase().includes(searchValue) ||
					localPath.toLowerCase().includes(searchValue)
				);
			};
			columnDef.sortingFn = (
				rowA: { original: TruckingFollowUpRow },
				rowB: { original: TruckingFollowUpRow },
			) => {
				const a1 = rowA.original.followUps?.[0];
				const b1 = rowB.original.followUps?.[0];
				const a = a1?.driveUrl || a1?.localPath || "";
				const b = b1?.driveUrl || b1?.localPath || "";
				return a.localeCompare(b);
			};
		}

		// Handle logJobs column - accessor and filter for logistics job numbers
		if (key === "logJobs") {
			columnDef.accessorFn = (row: TruckingFollowUpRow) => {
				const followUps = row.followUps || [];
				const jobNumbers = followUps
					.map((f) => f.jobNumber)
					.filter((jn): jn is string => !!jn);
				return [...new Set(jobNumbers)].join("\n");
			};
			columnDef.filterFn = (
				row: { original: TruckingFollowUpRow },
				_columnId: string,
				filterValue: any,
			) => {
				const followUps = row.original.followUps || [];
				const jobNumbers = followUps
					.map((f) => f.jobNumber)
					.filter((jn): jn is string => !!jn);
				const searchValue = String(filterValue).toLowerCase();
				return jobNumbers.some((jn) => jn.toLowerCase().includes(searchValue));
			};
		}

		if (config.cell) {
			const CellComponent = config.cell;
			const cellProps = config.cellProps || {};

			columnDef.cell = (props: any) => {
				const finalCellProps = { ...cellProps };
				// Enable multiline for non-date container fields with aggregated entries
				const NON_DATE_CONTAINER_FIELDS = new Set([
					"vesselName",
					"veselNumber",
					"pickOrLiftPlace",
					"maLo",
					"invoiceTaxCode",
				]);
				if (NON_DATE_CONTAINER_FIELDS.has(key)) {
					const val = props.getValue?.() as string | undefined;
					if (val?.includes("\n")) finalCellProps.multiline = true;
				}
				// mass-update fields (aggregate from FCRs)
				const MASS_UPDATE_FIELDS = new Set([
					"implementationDate",
					"vendor",
					"warehouse",
					"truckType",
					"tTypeC",
					"fromLocation",
					"toLocation",
					"cutOffTime",
					"closingTime",
					"ops",
				]);
				if (MASS_UPDATE_FIELDS.has(key)) {
					const val = props.getValue?.() as string | undefined;
					if (val?.includes("\n")) {
						finalCellProps.multiline = true;
					}
				}

				// Lock truckType and tTypeC if containers exist
				if (key === "truckType" || key === "tTypeC") {
					const row = props.row.original;
					if (row.containers && row.containers.length > 0) {
						finalCellProps.readOnly = true;
					}
				}

				// Highlight fallback values for note5 (differentiate FCR values from original values)
				if (key === "note5") {
					const originalRow = props.row.original;
					if (!originalRow.note5 && props.getValue()) {
						finalCellProps.viewClassName =
							"text-muted-foreground italic rounded bg-muted/30";
					}
				}

				return <CellComponent {...props} {...finalCellProps} />;
			};
		} else {
			columnDef.cell = (props: any) => <span>{props.getValue() || ""}</span>;
		}

		acc.push(columnDef as ColumnDef<TruckingFollowUpRow>);
		return acc;
	}, []);
};
