import {
	type RenderOptions,
	render as rtlRender,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

const Providers = ({ children }: { children: ReactNode }) => children;

const render = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
	rtlRender(ui, {
		wrapper: Providers,
		...options,
	});

export * from "@testing-library/react";
export { render };
