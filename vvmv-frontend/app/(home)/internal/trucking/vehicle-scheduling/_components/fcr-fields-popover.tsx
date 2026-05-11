"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverPositioner,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ALL_OPTIONAL_FIELDS } from "@/lib/trucking/fcr-fields";
import { useFCRFieldsStore } from "../use-fcr-fields-store";

export function FCRFieldsPopover() {
	const [isHydrated, setIsHydrated] = useState(false);
	const { visibleFields, toggle, selectAll, clearAll } = useFCRFieldsStore();
	const isAllSelected = visibleFields.length === ALL_OPTIONAL_FIELDS.length;

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	function handleToggleAll() {
		if (isAllSelected) {
			clearAll();
			return;
		}
		selectAll();
	}

	if (!isHydrated) {
		return (
			<button
				type="button"
				className="p-1 rounded hover:bg-slate-100 text-slate-600"
				aria-label="Hiển thị trường FCR"
			>
				<Settings2 className="w-4 h-4" />
			</button>
		);
	}

	return (
		<Popover>
			<PopoverTrigger className="p-1 rounded hover:bg-slate-100 text-slate-600">
				<Settings2 className="w-4 h-4" />
			</PopoverTrigger>
			<PopoverPositioner side="bottom" align="end">
				<PopoverContent className="w-44 p-2 z-[999]">
					<div className="flex items-center justify-between gap-1 px-1 mb-1.5">
						<p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
							Hiển thị trên FCR
						</p>
						<button
							type="button"
							onClick={handleToggleAll}
							className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
						>
							{isAllSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
						</button>
					</div>
					{ALL_OPTIONAL_FIELDS.map(({ key, label }) => (
						<button
							key={key}
							type="button"
							onClick={() => toggle(key)}
							className="flex items-center gap-2 w-full px-1 py-1 rounded text-xs text-slate-700 hover:bg-slate-100 transition-colors"
						>
							<span
								className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
									visibleFields.includes(key)
										? "bg-blue-500 border-blue-500 text-white"
										: "border-slate-300"
								}`}
							>
								{visibleFields.includes(key) && (
									<svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
										<path
											d="M2 5l2.5 2.5L8 3"
											stroke="currentColor"
											strokeWidth="1.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</span>
							{label}
						</button>
					))}
				</PopoverContent>
			</PopoverPositioner>
		</Popover>
	);
}
