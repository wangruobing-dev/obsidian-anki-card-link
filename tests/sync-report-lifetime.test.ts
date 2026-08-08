import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSyncReportLifetime } from '../src/ui/sync-report-lifetime';

describe('sync report lifetime', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('closes after five seconds unless hovered, then restarts the timer when the pointer leaves', () => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const hide = vi.fn();
		const lifetime = createSyncReportLifetime(hide);
		lifetime.start();
		vi.advanceTimersByTime(4_000);
		lifetime.pause();
		vi.advanceTimersByTime(5_000);
		expect(hide).not.toHaveBeenCalled();
		lifetime.start();
		vi.advanceTimersByTime(5_000);
		expect(hide).toHaveBeenCalledTimes(1);
	});

	it('closes immediately when dismissed', () => {
		vi.useFakeTimers();
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const hide = vi.fn();
		const lifetime = createSyncReportLifetime(hide);
		lifetime.start();
		lifetime.dismiss();
		vi.advanceTimersByTime(5_000);
		expect(hide).toHaveBeenCalledTimes(1);
	});
});
