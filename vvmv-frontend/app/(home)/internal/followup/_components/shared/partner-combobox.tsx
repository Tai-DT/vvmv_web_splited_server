"use client";

import { usePartners } from "@/hooks/use-partners";
import {
	VirtualizedCombobox,
	type VirtualizedComboboxProps,
} from "./virtualized-combobox";

interface PartnerComboboxProps extends Omit<VirtualizedComboboxProps, "items"> {
	onPartnerSelect?: (
		partner: { id: string; name: string; domain?: string } | null,
	) => void;
}

export function PartnerCombobox({
	onPartnerSelect,
	onChange,
	...props
}: PartnerComboboxProps) {
	const { partners, isLoading } = usePartners();

	const handleChange = (value: string) => {
		// Call original onChange
		onChange?.(value);

		// Also call onPartnerSelect with full partner data including domain
		if (onPartnerSelect) {
			const selectedPartner = partners.find((p) => p.id === value);
			onPartnerSelect(selectedPartner || null);
		}
	};

	return (
		<VirtualizedCombobox
			{...props}
			items={partners}
			onChange={handleChange}
			placeholder={
				isLoading
					? "Loading partners..."
					: props.placeholder || "Select partner..."
			}
			searchPlaceholder={
				props.searchPlaceholder || "Search by tax code or name..."
			}
			emptyMessage={
				isLoading
					? "Loading data, please wait..."
					: props.emptyMessage || "No partners found."
			}
		/>
	);
}
