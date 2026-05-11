import { useSyncExternalStore } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

function subscribe(onStoreChange: () => void) {
	if (typeof window === "undefined") return () => {};
	const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
	mql.addEventListener("change", onStoreChange);
	return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
	if (typeof window === "undefined") return false;
	return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
	return false;
}

export function useIsMobile() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
