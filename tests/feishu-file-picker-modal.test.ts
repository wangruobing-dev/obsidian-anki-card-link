import { describe, expect, it } from 'vitest';
import {
	getNextCollapsedFolders,
	getSelectionState,
	isFolderExpanded,
} from '../src/ui/feishu-file-picker-state';

describe('FeishuFilePickerModal state helpers', () => {
	it('keeps a parent folder indeterminate when only some child files are selected', () => {
		const files = [{ path: 'A/one.md' }, { path: 'A/two.md' }, { path: 'A/B/three.md' }];

		expect(getSelectionState(files, new Set(['A/one.md']))).toEqual({
			checked: false,
			indeterminate: true,
		});
		expect(getSelectionState(files, new Set(files.map((file) => file.path)))).toEqual({
			checked: true,
			indeterminate: false,
		});
	});

	it('tracks collapsed folders separately from selection redraws', () => {
		const collapsed = getNextCollapsedFolders(new Set<string>(), 'A/B');
		const afterSelectionRedraw = new Set(collapsed);

		expect(isFolderExpanded('A/B', afterSelectionRedraw)).toBe(false);
		expect(isFolderExpanded('A/C', afterSelectionRedraw)).toBe(true);
		expect(isFolderExpanded('A/B', getNextCollapsedFolders(afterSelectionRedraw, 'A/B'))).toBe(true);
	});
});
