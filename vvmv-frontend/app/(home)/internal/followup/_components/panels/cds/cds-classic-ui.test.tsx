import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FollowUpCdsInfoRow } from "../../../types";
import {
	BufferedInput,
	ClassicCodeLookupSelect,
	ClassicSelect,
	focusNextCdsEditableControl,
} from "./cds-classic-ui";

describe("BufferedInput", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("keeps focused edits local until the field is blurred", () => {
		vi.useFakeTimers();
		const onCommit = vi.fn();

		render(
			<BufferedInput aria-label="CDS field" value="" onCommit={onCommit} />,
		);

		const input = screen.getByLabelText("CDS field") as HTMLInputElement;

		input.focus();
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "02DSEA0" } });

		expect(input).toHaveValue("02DSEA0");

		vi.advanceTimersByTime(500);

		expect(onCommit).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(input);

		fireEvent.blur(input);

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("02DSEA0");
	});

	it("still auto-commits buffered edits when the field is not focused", () => {
		vi.useFakeTimers();
		const onCommit = vi.fn();

		render(
			<BufferedInput aria-label="CDS field" value="" onCommit={onCommit} />,
		);

		fireEvent.change(screen.getByLabelText("CDS field"), {
			target: { value: "VNZZZ" },
		});

		vi.advanceTimersByTime(399);
		expect(onCommit).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("VNZZZ");
	});

	it("commits and focuses the next editable field on Enter", () => {
		const onFirstCommit = vi.fn();
		const onSecondCommit = vi.fn();

		render(
			<div data-cds-scroll-region="active">
				<BufferedInput
					aria-label="First CDS field"
					value=""
					onCommit={onFirstCommit}
				/>
				<BufferedInput
					aria-label="Second CDS field"
					value=""
					onCommit={onSecondCommit}
				/>
			</div>,
		);

		const firstInput = screen.getByLabelText(
			"First CDS field",
		) as HTMLInputElement;
		const secondInput = screen.getByLabelText(
			"Second CDS field",
		) as HTMLInputElement;

		firstInput.focus();
		fireEvent.focus(firstInput);
		fireEvent.change(firstInput, { target: { value: "02DSEA0" } });
		fireEvent.keyDown(firstInput, { key: "Enter" });

		expect(onFirstCommit).toHaveBeenCalledTimes(1);
		expect(onFirstCommit).toHaveBeenCalledWith("02DSEA0");
		expect(document.activeElement).toBe(secondInput);
	});

	it("prefers the same column on the next row when Enter ends an input", () => {
		const onFirstCommit = vi.fn();

		render(
			<div data-cds-scroll-region="active">
				<div>
					<BufferedInput
						aria-label="Row 1 column 1"
						value=""
						onCommit={onFirstCommit}
					/>
					<BufferedInput
						aria-label="Row 1 column 2"
						value=""
						onCommit={vi.fn()}
					/>
				</div>
				<div>
					<BufferedInput
						aria-label="Row 2 column 1"
						value=""
						onCommit={vi.fn()}
					/>
					<BufferedInput
						aria-label="Row 2 column 2"
						value=""
						onCommit={vi.fn()}
					/>
				</div>
			</div>,
		);

		const row1Column1 = screen.getByLabelText(
			"Row 1 column 1",
		) as HTMLInputElement;
		const row1Column2 = screen.getByLabelText(
			"Row 1 column 2",
		) as HTMLInputElement;
		const row2Column1 = screen.getByLabelText(
			"Row 2 column 1",
		) as HTMLInputElement;
		const row2Column2 = screen.getByLabelText(
			"Row 2 column 2",
		) as HTMLInputElement;

		vi.spyOn(row1Column1, "getBoundingClientRect").mockReturnValue({
			bottom: 22,
			height: 22,
			left: 10,
			right: 110,
			top: 0,
			width: 100,
			x: 10,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
		vi.spyOn(row1Column2, "getBoundingClientRect").mockReturnValue({
			bottom: 22,
			height: 22,
			left: 130,
			right: 230,
			top: 0,
			width: 100,
			x: 130,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);
		vi.spyOn(row2Column1, "getBoundingClientRect").mockReturnValue({
			bottom: 54,
			height: 22,
			left: 10,
			right: 110,
			top: 32,
			width: 100,
			x: 10,
			y: 32,
			toJSON: () => ({}),
		} as DOMRect);
		vi.spyOn(row2Column2, "getBoundingClientRect").mockReturnValue({
			bottom: 54,
			height: 22,
			left: 130,
			right: 230,
			top: 32,
			width: 100,
			x: 130,
			y: 32,
			toJSON: () => ({}),
		} as DOMRect);

		row1Column1.focus();
		fireEvent.focus(row1Column1);
		fireEvent.change(row1Column1, { target: { value: "02DSEA0" } });
		fireEvent.keyDown(row1Column1, { key: "Enter" });

		expect(onFirstCommit).toHaveBeenCalledWith("02DSEA0");
		expect(document.activeElement).toBe(row2Column1);
	});

	it("does not steal focus back when a delayed retry is pending", () => {
		vi.useFakeTimers();

		render(
			<div data-cds-scroll-region="active">
				<input aria-label="First CDS field" />
				<input aria-label="Second CDS field" />
				<input aria-label="Third CDS field" />
			</div>,
		);

		const firstInput = screen.getByLabelText(
			"First CDS field",
		) as HTMLInputElement;
		const secondInput = screen.getByLabelText(
			"Second CDS field",
		) as HTMLInputElement;
		const thirdInput = screen.getByLabelText(
			"Third CDS field",
		) as HTMLInputElement;

		firstInput.focus();
		focusNextCdsEditableControl(firstInput, { retry: true });
		expect(document.activeElement).toBe(secondInput);

		thirdInput.focus();
		vi.runOnlyPendingTimers();

		expect(document.activeElement).toBe(thirdInput);
	});

	it("restores the active CDS scroll position when moving focus", () => {
		render(
			<div data-testid="scroll-region" data-cds-scroll-region="active">
				<input aria-label="First CDS field" />
				<input aria-label="Second CDS field" />
			</div>,
		);

		const scrollRegion = screen.getByTestId("scroll-region");
		const firstInput = screen.getByLabelText(
			"First CDS field",
		) as HTMLInputElement;
		const secondInput = screen.getByLabelText(
			"Second CDS field",
		) as HTMLInputElement;
		const secondInputFocus = secondInput.focus.bind(secondInput);

		scrollRegion.scrollTop = 420;
		scrollRegion.scrollLeft = 12;
		vi.spyOn(secondInput, "focus").mockImplementation((options) => {
			scrollRegion.scrollTop = 0;
			scrollRegion.scrollLeft = 0;
			secondInputFocus(options);
		});

		firstInput.focus();
		focusNextCdsEditableControl(firstInput);

		expect(document.activeElement).toBe(secondInput);
		expect(scrollRegion.scrollTop).toBe(420);
		expect(scrollRegion.scrollLeft).toBe(12);
	});
});

describe("ClassicSelect", () => {
	it("keeps lookup codes visible in option labels", () => {
		render(
			<ClassicSelect
				fieldKey={"paymentMethod" as keyof FollowUpCdsInfoRow}
				data={{ paymentMethod: "TTR" }}
				handleFieldChange={vi.fn()}
				getLookupOptionsForField={() => [
					{ value: "TTR", label: "TTR - Chuyen tien boi hoan bang dien" },
				]}
				getInitialEntryLockReason={() => null}
				usesManualLookupPicker={() => false}
				openLookupDialogForField={vi.fn()}
				resolveFieldLockState={() => ({
					disabledReason: null,
					isDisabled: false,
				})}
				getLookupDescription={() => ""}
				ecusInputCls=""
				ecusSelectCls=""
				ecusTextareaCls=""
				ecusDisabledFieldCls=""
				ecusDisabledButtonCls=""
				ecusClassicInputCls=""
				ecusClassicSelectCls=""
				ecusClassicReadonlyCls=""
				ecusClassicButtonCls=""
			/>,
		);

		const select = screen.getByRole("combobox") as HTMLSelectElement;

		expect(select.options[1]?.textContent).toBe(
			"TTR - Chuyen tien boi hoan bang dien",
		);
	});

	it("shows only the code in the input but keeps names in code-only dropdown options", () => {
		render(
			<ClassicSelect
				fieldKey={"packageType" as keyof FollowUpCdsInfoRow}
				data={{ packageType: "PR - Đôi/cặp" }}
				displayMode="code-only"
				handleFieldChange={vi.fn()}
				getLookupOptionsForField={() => [
					{ value: "PR", label: "PR - Đôi/cặp" },
				]}
				getInitialEntryLockReason={() => null}
				usesManualLookupPicker={() => false}
				openLookupDialogForField={vi.fn()}
				resolveFieldLockState={() => ({
					disabledReason: null,
					isDisabled: false,
				})}
				getLookupDescription={() => ""}
				ecusInputCls=""
				ecusSelectCls=""
				ecusTextareaCls=""
				ecusDisabledFieldCls=""
				ecusDisabledButtonCls=""
				ecusClassicInputCls=""
				ecusClassicSelectCls=""
				ecusClassicReadonlyCls=""
				ecusClassicButtonCls=""
			/>,
		);

		const input = screen.getByRole("textbox") as HTMLInputElement;
		const select = screen.getByRole("combobox") as HTMLSelectElement;

		expect(input).toHaveValue("PR");
		expect(select.options[1]?.textContent).toBe("PR - Đôi/cặp");
	});

	it("separates code and name in classic code lookup fields", () => {
		render(
			<ClassicCodeLookupSelect
				fieldKey={"loadingLocationCode" as keyof FollowUpCdsInfoRow}
				data={{
					loadingLocationCode: "VNCLI - Cat Lai",
					loadingLocationName: "VNCLI - Cat Lai",
				}}
				handleFieldChange={vi.fn()}
				getLookupOptionsForField={() => [
					{ value: "VNCLI", label: "VNCLI - Cat Lai" },
				]}
				getInitialEntryLockReason={() => null}
				usesManualLookupPicker={() => false}
				openLookupDialogForField={vi.fn()}
				resolveFieldLockState={() => ({
					disabledReason: null,
					isDisabled: false,
				})}
				getLookupDescription={() => "Cat Lai"}
				ecusInputCls=""
				ecusSelectCls=""
				ecusTextareaCls=""
				ecusDisabledFieldCls=""
				ecusDisabledButtonCls=""
				ecusClassicInputCls=""
				ecusClassicSelectCls=""
				ecusClassicReadonlyCls=""
				ecusClassicButtonCls=""
			/>,
		);

		const input = screen.getByRole("textbox") as HTMLInputElement;
		const select = screen.getByRole("combobox") as HTMLSelectElement;

		expect(input).toHaveValue("VNCLI");
		expect(select.options[0]?.textContent).toBe("Cat Lai");
		expect(select.options[1]?.textContent).toBe("VNCLI - Cat Lai");
	});
});
