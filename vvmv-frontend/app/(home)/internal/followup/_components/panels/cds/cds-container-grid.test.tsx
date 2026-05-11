import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { CdsContainerGrid } from "./cds-container-grid";

function renderCdsContainerGrid(
	props: Partial<ComponentProps<typeof CdsContainerGrid>> = {},
) {
	const defaultProps: ComponentProps<typeof CdsContainerGrid> = {
		containerGridValues: [],
		containerImportFileRef: createRef<HTMLInputElement>(),
		ecusClassicButtonCls: "",
		ecusClassicInputCls: "",
		ecusClassicSelectCls: "",
		ecusDisabledButtonCls: "",
		ecusDisabledFieldCls: "",
		handleContainerExcelImport: vi.fn(),
		handleContainerSlotChange: vi.fn().mockResolvedValue(undefined),
		handleFieldChange: vi.fn(),
		handleOpenTruckLoadingLocationLookup: vi.fn(),
		truckLoadingLocationOptions: [],
		updateContainerNumber: vi.fn(),
		data: {},
	};

	return render(<CdsContainerGrid {...defaultProps} {...props} />);
}

describe("CdsContainerGrid", () => {
	it("shows location names next to location codes in code selects", () => {
		renderCdsContainerGrid();

		const select = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;

		expect(select.options[1].textContent).toBe(
			"VNADTT - CUA KHAU A DOT (THUA THIEN-HUE)",
		);
	});

	it("normalizes saved truck loading location codes before selecting options", () => {
		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: " vnadtt - CUA KHAU A DOT ",
				truckLoadingLocationName: "CUA KHAU A DOT (THUA THIEN-HUE)",
			},
		});

		const firstSelect = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;
		const secondSelect = screen.getByLabelText(
			"Mã địa điểm xếp hàng 2",
		) as HTMLSelectElement;

		expect(firstSelect.value).toBe("VNADTT");
		expect(secondSelect.value).toBe("");
	});

	it("clears the paired location name when a code slot is cleared", () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: "VNADTT.VNAPIT",
				truckLoadingLocationName:
					"CUA KHAU A DOT (THUA THIEN-HUE), LOI MO A PA CHAI",
				truckLoadingLocationAddress: "Dia chi cua ma cu",
			},
			handleFieldChange,
		});

		const select = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;

		fireEvent.change(select, { target: { value: "" } });

		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationCode",
			"VNAPIT",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationName",
			"LOI MO A PA CHAI",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			null,
		);
	});

	it("allows the loading location address field to be edited", () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			data: { truckLoadingLocationAddress: "Dia chi cu" },
			handleFieldChange,
		});

		const addressField = screen.getByLabelText(
			"Địa chỉ địa điểm xếp hàng",
		) as HTMLTextAreaElement;

		expect(addressField).not.toHaveAttribute("readonly");
		expect(addressField).toHaveValue("Dia chi cu");

		fireEvent.change(addressField, {
			target: { value: "Dia chi moi" },
		});
		fireEvent.blur(addressField);

		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			"Dia chi moi",
		);
	});

	it("uses full truck loading lookup options and fills address when a code is selected", () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			handleFieldChange,
			truckLoadingLocationOptions: [
				{
					value: "01PRZ61",
					label: "01PRZ61 - Công ty TNHH Inoac Việt Nam",
					meta: {
						address: "Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
					},
				},
			],
		});

		const select = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;

		expect(select.options[1].textContent).toBe(
			"1. 01PRZ61 - Công ty TNHH Inoac Việt Nam | Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
		);

		fireEvent.change(select, { target: { value: "01PRZ61" } });

		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationCode",
			"01PRZ61",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationName",
			"Công ty TNHH Inoac Việt Nam",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			"Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
		);
	});

	it("sorts truck loading codes by used count before code", () => {
		renderCdsContainerGrid({
			truckLoadingLocationOptions: [
				{
					value: "ZZLOW",
					label: "ZZLOW - Low usage",
					meta: { usedCount: "1" },
				},
				{
					value: "AAHIGH",
					label: "AAHIGH - High usage",
					meta: { usedCount: "999" },
				},
			],
		});

		const select = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;

		expect(select.options[1].value).toBe("AAHIGH");
		expect(select.options[2].value).toBe("ZZLOW");
	});

	it("fills a missing address when truck loading lookups arrive for an existing code", async () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: "01PRZ61",
				truckLoadingLocationAddress: "",
			},
			handleFieldChange,
			truckLoadingLocationOptions: [
				{
					value: "01PRZ61",
					label: "01PRZ61 - Công ty TNHH Inoac Việt Nam",
					meta: {
						address: "Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
						usedCount: "5969",
					},
				},
			],
		});

		await waitFor(() => {
			expect(handleFieldChange).toHaveBeenCalledWith(
				"truckLoadingLocationAddress",
				"Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
			);
		});
	});

	it("keeps the address from the first selected loading code when later slots change", () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: "01PRZ61",
				truckLoadingLocationAddress: "Dia chi dau tien",
			},
			handleFieldChange,
			truckLoadingLocationOptions: [
				{
					value: "01PRZ61",
					label: "01PRZ61 - First location",
					meta: {
						address: "Dia chi dau tien",
					},
				},
				{
					value: "02NEXT",
					label: "02NEXT - Later location",
					meta: {
						address: "Dia chi phia sau",
					},
				},
			],
		});

		const secondSelect = screen.getByLabelText(
			"Mã địa điểm xếp hàng 2",
		) as HTMLSelectElement;

		fireEvent.change(secondSelect, { target: { value: "02NEXT" } });

		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationCode",
			"01PRZ61.02NEXT",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationName",
			"First location",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			"Dia chi dau tien",
		);
		expect(handleFieldChange).not.toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			"Dia chi phia sau",
		);
		expect(handleFieldChange).not.toHaveBeenCalledWith(
			"truckLoadingLocationName",
			"Later location",
		);
	});

	it("does not use a later loading code address when the first selected code has no address", () => {
		const handleFieldChange = vi.fn();

		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: "VNAPIT",
				truckLoadingLocationAddress: "Dia chi cu",
			},
			handleFieldChange,
			truckLoadingLocationOptions: [
				{
					value: "VNAPIT",
					label: "VNAPIT - LOI MO A PA CHAI",
				},
				{
					value: "01PRZ61",
					label: "01PRZ61 - Công ty TNHH Inoac Việt Nam",
					meta: {
						address: "Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
					},
				},
			],
		});

		const secondSelect = screen.getByLabelText(
			"Mã địa điểm xếp hàng 2",
		) as HTMLSelectElement;

		fireEvent.change(secondSelect, { target: { value: "01PRZ61" } });

		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationCode",
			"VNAPIT.01PRZ61",
		);
		expect(handleFieldChange).toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			null,
		);
		expect(handleFieldChange).not.toHaveBeenCalledWith(
			"truckLoadingLocationAddress",
			"Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
		);
	});

	it("shows only the code in the selected code control", () => {
		renderCdsContainerGrid({
			data: {
				truckLoadingLocationCode: "01PRZ61",
			},
			truckLoadingLocationOptions: [
				{
					value: "01PRZ61",
					label: "01PRZ61 - Công ty TNHH Inoac Việt Nam",
					meta: {
						address: "Lô 36, KCN Quang Minh, Mê Linh, Hà Nội",
						usedCount: "5969",
					},
				},
			],
		});

		const select = screen.getByLabelText(
			"Mã địa điểm xếp hàng 1",
		) as HTMLSelectElement;
		const selectedOption = select.selectedOptions[0];

		expect(select.value).toBe("01PRZ61");
		expect(selectedOption?.textContent).toBe("01PRZ61");
	});
});
