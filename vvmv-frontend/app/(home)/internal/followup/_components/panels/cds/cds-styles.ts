// cds-styles.ts – centralized CSS class strings for CDS components
import { cn } from "@/lib/utils";

export const ecusInputCls =
	"h-[26px] rounded-none border-slate-400 bg-white px-1.5 text-left text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:border-[#8c8c8c] disabled:bg-[#c9c9c9] disabled:text-black disabled:placeholder:text-slate-700 disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";

export const ecusSelectCls =
	"h-[26px] rounded-none border-slate-400 bg-[#efefef] text-left text-[11px] shadow-none disabled:border-[#8c8c8c] disabled:bg-[#c9c9c9] disabled:text-black disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";

export const ecusTextareaCls =
	"rounded-none border-slate-400 bg-white px-1.5 text-left text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:border-[#8c8c8c] disabled:bg-[#c9c9c9] disabled:text-black disabled:placeholder:text-slate-700 disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";

export const ecusClassicInputCls =
	"h-[22px] w-full rounded-none border border-slate-500 bg-white px-1 text-left text-[11px] text-slate-900 shadow-none outline-none focus-visible:ring-0 focus:border-sky-700 disabled:border-[#8c8c8c] disabled:bg-[#c9c9c9] disabled:text-black disabled:placeholder:text-slate-700 disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";

export const ecusClassicReadonlyCls = cn(
	ecusClassicInputCls,
	"cursor-default bg-white text-slate-900",
);

export const ecusClassicSelectCls = cn(
	ecusClassicInputCls,
	"bg-white disabled:bg-[#d9d9d9]",
);

export const ecusClassicButtonCls =
	"inline-flex h-[22px] items-center justify-center border border-[#7f7f7f] bg-[linear-gradient(180deg,#f6f6f6_0%,#d7d7d7_100%)] px-2 text-[11px] text-[#2f2f2f] shadow-[inset_1px_1px_0_#ffffff,inset_-1px_-1px_0_#b5b5b5] transition hover:bg-[linear-gradient(180deg,#ffffff_0%,#dddddd_100%)] active:bg-[linear-gradient(180deg,#d4d4d4_0%,#efefef_100%)] disabled:border-[#8c8c8c] disabled:bg-[linear-gradient(180deg,#e7e7e7_0%,#d1d1d1_100%)] disabled:text-black disabled:opacity-100 disabled:shadow-none disabled:cursor-default";

export const ecusDisabledFieldCls =
	"border-[#8c8c8c] bg-[#c9c9c9] text-black opacity-100 disabled:!border-[#8c8c8c] disabled:!bg-[#c9c9c9] disabled:!text-black disabled:!opacity-100 disabled:[-webkit-text-fill-color:#000]";
export const ecusDisabledButtonCls =
	"border-[#8c8c8c] bg-[#c3c3c3] text-black opacity-100 disabled:!border-[#8c8c8c] disabled:!bg-[#c3c3c3] disabled:!text-black disabled:!opacity-100";

export const ecusTableInputCls =
	"h-[22px] rounded-none border-slate-400 bg-[#f5f5f5] px-1 text-left text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:border-[#8c8c8c] disabled:bg-[#c9c9c9] disabled:text-black disabled:placeholder:text-slate-700 disabled:opacity-100 disabled:[-webkit-text-fill-color:#000]";

export const ecusBillTableInputCls = cn(ecusTableInputCls, "bg-white");

// Layout class constants shared across tab components
export const importPanelRailCls = "w-full px-[4px]";
export const importDualLaneRowCls =
	"grid grid-cols-1 lg:grid-cols-2 items-start gap-x-6 gap-y-1";
export const importPanelFrameCls =
	"mx-auto w-full border border-[#a8a8a8] bg-[#efefef] px-[6px] py-[6px] xl:max-w-[1240px] xl:px-[8px]";
export const importContractRowCls =
	"grid grid-cols-1 lg:grid-cols-[360px_1fr] items-start gap-x-6 gap-y-1";

// Responsive field row: label + input on one row on desktop, stacked on mobile
export const importFieldRowCls =
	"grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5";

// Export-general layout helpers tuned to resemble the desktop ECUS form more closely.
export const exportClassicPanelFrameCls =
	"mx-auto w-full border border-[#a8a8a8] bg-[#efefef] px-[6px] py-[6px] xl:max-w-[1240px] xl:px-[8px]";
export const exportClassicFormBodyCls = "w-full space-y-[6px] text-[11px]";
export const exportClassicTopGridCls =
	"grid w-full grid-cols-1 gap-x-6 gap-y-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]";
export const exportClassicSectionBodyCls = "px-[4px] pt-[2px] text-[11px]";
export const exportClassicPartyTitleCls =
	"pl-0 text-[12px] font-semibold text-black";
