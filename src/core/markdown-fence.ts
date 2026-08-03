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
