export const SYNC_REPORT_DURATION_MS = 5_000;

export interface SyncReportLifetime {
	start: () => void;
	pause: () => void;
	dismiss: () => void;
}

export function createSyncReportLifetime(
	hide: () => void,
	durationMs = SYNC_REPORT_DURATION_MS,
): SyncReportLifetime {
	let timeoutId: number | undefined;
	const pause = (): void => {
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
			timeoutId = undefined;
		}
	};
	const dismiss = (): void => {
		pause();
		hide();
	};
	return {
		start: (): void => {
			if (timeoutId === undefined) {
				timeoutId = window.setTimeout(dismiss, durationMs);
			}
		},
		pause,
		dismiss,
	};
}
