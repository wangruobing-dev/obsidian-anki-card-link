export function hasUnclosedCodeFence(lines: string[], startLine: number, endExclusive: number): boolean {
	let openingFence: { marker: '`' | '~'; length: number } | undefined;
	for (let index = startLine; index < endExclusive; index += 1) {
		const match = /^\s*(`{3,}|~{3,})/u.exec(lines[index] ?? '');
		if (match?.[1] === undefined) {
			continue;
		}
		const marker = match[1][0];
		if (marker !== '`' && marker !== '~') {
			continue;
		}
		if (openingFence === undefined) {
			openingFence = { marker, length: match[1].length };
		} else if (marker === openingFence.marker && match[1].length >= openingFence.length) {
			openingFence = undefined;
		}
	}
	return openingFence !== undefined;
}

/** 返回围栏起止行及围栏内部行，供解析、命令和阅读模式共用同一套判断。 */
export function getFencedLines(lines: readonly string[]): Set<number> {
	const fenced = new Set<number>();
	let openingFence: { marker: '`' | '~'; length: number } | undefined;
	for (let index = 0; index < lines.length; index += 1) {
		const match = /^\s*(`{3,}|~{3,})/u.exec(lines[index] ?? '');
		if (openingFence !== undefined) {
			fenced.add(index);
		}
		const marker = match?.[1]?.[0];
		if (marker !== '`' && marker !== '~') {
			continue;
		}
		if (openingFence === undefined) {
			openingFence = { marker, length: match?.[1]?.length ?? 3 };
			fenced.add(index);
		} else if (marker === openingFence.marker && (match?.[1]?.length ?? 0) >= openingFence.length) {
			openingFence = undefined;
		}
	}
	return fenced;
}
