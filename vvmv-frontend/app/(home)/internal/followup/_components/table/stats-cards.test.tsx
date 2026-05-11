import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/test-utils";
import { StatsCards } from "./stats-cards";

const getCard = (label: string) => {
	const card = screen.getByText(label).closest("div.cursor-pointer");

	if (!card) {
		throw new Error(`Could not find card for label "${label}"`);
	}

	return card as HTMLElement;
};

describe("StatsCards", () => {
	const defaultProps = {
		active: 5,
		activeNoTrucking: 2,
		activeWithTrucking: 3,
		finished: 3,
		done: 2,
		currentFilter: "all" as const,
		onFilterChange: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Rendering", () => {
		it("should render all 4 stat cards", () => {
			render(<StatsCards {...defaultProps} />);
			expect(screen.getByText("Total")).toBeInTheDocument();
			expect(screen.getByText("Active")).toBeInTheDocument();
			expect(screen.getByText("Finished")).toBeInTheDocument();
			expect(screen.getByText("Done")).toBeInTheDocument();
		});

		it("should display correct count values", () => {
			render(<StatsCards {...defaultProps} />);

			// Total = active + finished + done = 5 + 3 + 2 = 10
			expect(within(getCard("Total")).getByText("10")).toBeInTheDocument();
			expect(within(getCard("Active")).getByText("5")).toBeInTheDocument();
			expect(within(getCard("Finished")).getByText("3")).toBeInTheDocument();
			expect(within(getCard("Done")).getByText("2")).toBeInTheDocument();
		});

		it("should calculate total correctly", () => {
			render(
				<StatsCards {...defaultProps} active={10} finished={20} done={30} />,
			);

			// Total should be 60
			expect(screen.getByText("60")).toBeInTheDocument();
		});
	});

	describe("Active State Highlighting", () => {
		it("should highlight the 'all' card when currentFilter is 'all'", () => {
			render(<StatsCards {...defaultProps} currentFilter="all" />);

			const allCard = getCard("Total");
			expect(allCard).toHaveClass("bg-blue-50");
			expect(allCard).toHaveClass("border-blue-200");
		});

		it("should highlight the 'active' card when currentFilter is 'active'", () => {
			render(<StatsCards {...defaultProps} currentFilter="active" />);

			const activeCard = getCard("Active");
			expect(activeCard).toHaveClass("bg-amber-50");
			expect(activeCard).toHaveClass("border-amber-200");
		});

		it("should highlight the 'finished' card when currentFilter is 'finished'", () => {
			render(<StatsCards {...defaultProps} currentFilter="finished" />);

			const finishedCard = getCard("Finished");
			expect(finishedCard).toHaveClass("bg-emerald-50");
			expect(finishedCard).toHaveClass("border-emerald-200");
		});

		it("should highlight the 'done' card when currentFilter is 'done'", () => {
			render(<StatsCards {...defaultProps} currentFilter="done" />);

			const doneCard = getCard("Done");
			expect(doneCard).toHaveClass("bg-indigo-50");
			expect(doneCard).toHaveClass("border-indigo-200");
		});

		it("should not highlight inactive cards", () => {
			render(<StatsCards {...defaultProps} currentFilter="active" />);

			// All card should not be highlighted
			const allCard = getCard("Total");
			expect(allCard).toHaveClass("bg-white");
			expect(allCard).toHaveClass("border-slate-200");

			// Finished card should not be highlighted
			const finishedCard = getCard("Finished");
			expect(finishedCard).toHaveClass("bg-white");
			expect(finishedCard).toHaveClass("border-slate-200");
		});
	});

	describe("Click Interactions", () => {
		it("should call onFilterChange with 'all' when Total card is clicked", async () => {
			const user = userEvent.setup();
			render(<StatsCards {...defaultProps} />);

			const totalCard = getCard("Total");
			await user.click(totalCard);

			expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(1);
			expect(defaultProps.onFilterChange).toHaveBeenCalledWith("all");
		});

		it("should call onFilterChange with 'active' when Active card is clicked", async () => {
			const user = userEvent.setup();
			render(<StatsCards {...defaultProps} />);

			const activeCard = getCard("Active");
			await user.click(activeCard);

			expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(1);
			expect(defaultProps.onFilterChange).toHaveBeenCalledWith("active");
		});

		it("should call onFilterChange with 'finished' when Finished card is clicked", async () => {
			const user = userEvent.setup();
			render(<StatsCards {...defaultProps} />);

			const finishedCard = getCard("Finished");
			await user.click(finishedCard);

			expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(1);
			expect(defaultProps.onFilterChange).toHaveBeenCalledWith("finished");
		});

		it("should call onFilterChange with 'done' when Done card is clicked", async () => {
			const user = userEvent.setup();
			render(<StatsCards {...defaultProps} />);

			const doneCard = getCard("Done");
			await user.click(doneCard);

			expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(1);
			expect(defaultProps.onFilterChange).toHaveBeenCalledWith("done");
		});

		it("should allow clicking the same card multiple times", async () => {
			const user = userEvent.setup();
			render(<StatsCards {...defaultProps} />);

			const activeCard = getCard("Active");
			await user.click(activeCard);
			await user.click(activeCard);
			await user.click(activeCard);

			expect(defaultProps.onFilterChange).toHaveBeenCalledTimes(3);
			expect(defaultProps.onFilterChange).toHaveBeenCalledWith("active");
		});
	});

	describe("Edge Cases", () => {
		it("should handle zero counts", () => {
			render(<StatsCards {...defaultProps} active={0} finished={0} done={0} />);

			// Should display 0 for all cards
			const zeros = screen.getAllByText("0");
			expect(zeros.length).toBeGreaterThanOrEqual(4); // 4 cards with 0
		});

		it("should handle large numbers", () => {
			render(
				<StatsCards
					{...defaultProps}
					active={1000}
					finished={500}
					done={250}
				/>,
			);

			expect(screen.getByText("1750")).toBeInTheDocument(); // Total
			expect(screen.getByText("1000")).toBeInTheDocument(); // Active
			expect(screen.getByText("500")).toBeInTheDocument(); // Finished
			expect(screen.getByText("250")).toBeInTheDocument(); // Done
		});

		it("should handle single active job", () => {
			render(<StatsCards {...defaultProps} active={1} finished={0} done={0} />);

			// Both Total and Active will show "1"
			const ones = screen.getAllByText("1");
			expect(ones.length).toBeGreaterThanOrEqual(2);
		});

		it("should handle all jobs being done", () => {
			render(
				<StatsCards {...defaultProps} active={0} finished={0} done={100} />,
			);

			// Both Total and Done will show "100"
			const hundreds = screen.getAllByText("100");
			expect(hundreds.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("Visual Feedback", () => {
		it("should apply ring classes to active card", () => {
			render(<StatsCards {...defaultProps} currentFilter="active" />);

			const activeCard = getCard("Active");
			expect(activeCard).toHaveClass("ring-2");
			expect(activeCard).toHaveClass("ring-amber-500/20");
		});

		it("should apply scale transformation to active card", () => {
			render(<StatsCards {...defaultProps} currentFilter="done" />);

			const doneCard = getCard("Done");
			expect(doneCard).toHaveClass("scale-[1.02]");
		});

		it("should have cursor-pointer class on all cards", () => {
			render(<StatsCards {...defaultProps} />);

			const totalCard = getCard("Total");
			const activeCard = getCard("Active");
			const finishedCard = getCard("Finished");
			const doneCard = getCard("Done");

			expect(totalCard).toHaveClass("cursor-pointer");
			expect(activeCard).toHaveClass("cursor-pointer");
			expect(finishedCard).toHaveClass("cursor-pointer");
			expect(doneCard).toHaveClass("cursor-pointer");
		});
	});
});
