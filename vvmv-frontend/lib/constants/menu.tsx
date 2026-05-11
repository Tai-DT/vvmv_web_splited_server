import type { LucideIcon } from "lucide-react";
import {
	ClipboardList,
	Container,
	Package,
	ReceiptText,
	Settings,
	Truck,
} from "lucide-react";
import type { Role } from "@/types/auth";

export type SidebarItem =
	| {
			title: string;
			icon?: LucideIcon;
			link: string;
			items?: never;
			requiredRoles?: Role[]; // Optional: specify which roles can see this item
			requiredDepartments?: string[]; // Optional: specify which departments can see this item
	  }
	| {
			title: string;
			icon?: LucideIcon;
			link?: never;
			items?: SidebarItem[];
			requiredRoles?: Role[];
			requiredDepartments?: string[];
	  };

export const navigationItems: SidebarItem[] = [
	{
		title: "Tracking",
		link: "/external/tracking",
		icon: Package,
		// Public access
	},
	{
		title: "Logistics",
		icon: Container,
		requiredRoles: ["STAFF", "ADMIN", "MANAGER"],
		requiredDepartments: ["Logistics", "Trucking", "Document", "Accounting"],
		items: [
			{
				title: "Follow Up",
				link: "/internal/followup",
				icon: ClipboardList,
				requiredRoles: ["STAFF", "ADMIN", "MANAGER"],
				requiredDepartments: [
					"Logistics",
					"Trucking",
					"Document",
					"Accounting",
				],
			},
			{
				title: "Declaration Report",
				link: "/internal/followup/declaration-report",
				requiredRoles: ["STAFF", "MANAGER", "ADMIN", "SUPERADMIN"],
				requiredDepartments: ["Logistics", "Document"],
			},
			{
				title: "Warehouse",
				link: "/internal/trucking/warehouse",
				requiredDepartments: ["Logistics", "Trucking"],
			},
		],
	},
	{
		title: "Trucking",
		icon: Truck,
		requiredRoles: ["STAFF", "ADMIN", "MANAGER"],
		requiredDepartments: ["Trucking", "Accounting", "Logistics"],
		items: [
			{
				title: "Follow Up",
				link: "/internal/trucking-followup",
				requiredDepartments: ["Trucking", "Accounting"],
			},

			// {
			//   title: "Dispatch",
			//   link: "/internal/trucking/dispatch",
			//   requiredDepartments: ["Trucking"],
			// },
			{
				title: "Vehicle Scheduling",
				link: "/internal/trucking/vehicle-scheduling",
				requiredDepartments: ["Trucking"],
			},
			{
				title: "Tracking Management",
				link: "/internal/trucking/tracking",
				requiredDepartments: ["Trucking"],
			},
			{
				title: "Reports",
				requiredRoles: ["STAFF", "MANAGER", "ADMIN", "SUPERADMIN"],
				requiredDepartments: ["Trucking", "Logistics", "Document"],
				items: [
					{
						title: "Container Report",
						link: "/internal/trucking-followup/container-report",
					},

					{
						title: "Truck Report",
						link: "/internal/trucking-followup/truck-report",
					},
					{
						title: "Daily Report",
						link: "/internal/trucking-followup/daily-truck-report",
					},
				],
			},
			{
				title: "Config",
				requiredDepartments: ["Trucking", "Logistics"],
				items: [
					{
						title: "Vehicles",
						link: "/internal/trucking/vehicles",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Shipping Lines",
						link: "/internal/trucking/shipping-lines",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Vendors",
						link: "/internal/trucking/vendors",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Ops",
						link: "/internal/trucking/ops",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Foreign Ports",
						link: "/internal/trucking/foreign-ports",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Pick/Lift Places",
						link: "/internal/trucking/pick-or-lift-places",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Container Sizes",
						link: "/internal/trucking/container-size-configs",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Vendor Fees",
						link: "/internal/trucking/vendor-fee-types",
						requiredDepartments: ["Trucking"],
					},
					{
						title: "Warehouse",
						link: "/internal/trucking/warehouse",
						requiredDepartments: ["Trucking", "Logistics"],
					},
					{
						title: "Customs Warehouses",
						link: "/internal/trucking/customs-warehouses",
						requiredDepartments: ["Trucking"],
					},
				],
			},
		],
	},
	{
		title: "Accounting",
		icon: ReceiptText,
		requiredRoles: ["STAFF", "ADMIN", "MANAGER"],
		requiredDepartments: ["Accounting"],
		items: [
			{
				title: "Disbursement Report",
				link: "/internal/accounting/disbursement-report",
				requiredDepartments: ["Accounting"],
			},
		],
	},
	{
		title: "Settings",
		link: "/settings",
		icon: Settings,
		// No restrictions - shown to everyone
	},
];
