import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VirtualizedCombobox } from "./virtualized-combobox";

describe("VirtualizedCombobox", () => {
	it("shows the selected code when displaying the selected name", () => {
		render(
			<VirtualizedCombobox
				items={[{ id: "030", name: "Hai Phong" }]}
				value="030"
				onChange={vi.fn()}
				displayValue="name"
			/>,
		);

		expect(screen.getByText("030")).toBeInTheDocument();
		expect(screen.getByText("Hai Phong")).toBeInTheDocument();
	});

	it("does not expose hidden internal ids in the selected value", () => {
		render(
			<VirtualizedCombobox
				items={[{ id: "container-db-id", name: "CONT1234567" }]}
				value="container-db-id"
				onChange={vi.fn()}
				displayValue="name"
				hideId
			/>,
		);

		expect(screen.queryByText("container-db-id")).not.toBeInTheDocument();
		expect(screen.getByText("CONT1234567")).toBeInTheDocument();
	});
});
