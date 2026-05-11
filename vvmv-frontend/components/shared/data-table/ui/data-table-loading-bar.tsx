export function DataTableLoadingBar({ visible }: { visible: boolean }) {
	if (!visible) return null;

	return (
		<div className="absolute top-8 left-0 right-0 h-0.5 z-[60] overflow-hidden bg-blue-100 dark:bg-blue-900/30">
			<div className="h-full bg-blue-500 animate-[loading-bar_1.5s_infinite_linear]" />
		</div>
	);
}
