import { describe, expect, it } from "vitest";
import {
	isExplicitCargoUpdatePrompt,
	isExplicitUserUpdatePrompt,
	promptMentionsCargoScope,
} from "./cds-ai-chat-gates";

describe("cds-ai-chat-gates", () => {
	it("treats bỏ #123 as an explicit update (substring edits)", () => {
		expect(isExplicitUserUpdatePrompt("bỏ #123 trong tên hàng")).toBe(true);
	});

	it("treats sửa tên hàng as cargo-related wording", () => {
		expect(isExplicitCargoUpdatePrompt("sửa tên hàng dòng 2")).toBe(true);
	});

	it("promptMentionsCargoScope matches HS without spelling danh sách hàng", () => {
		expect(promptMentionsCargoScope("đổi mã HS thành 85423900")).toBe(true);
	});
});
