import { getClozeNumbers } from './card-parser';

export type ClozeNumberMode = 'next' | 'current';

export function getClozeNumber(cardText: string, mode: ClozeNumberMode): number {
	const numbers = getClozeNumbers(cardText);
	if (numbers.length === 0) {
		return 1;
	}
	if (mode === 'current') {
		return numbers[numbers.length - 1] ?? 1;
	}
	return Math.max(...numbers) + 1;
}

export function buildClozeReplacement(selection: string, number: number): string {
	return `{{c${number}::${selection}}}`;
}

export function getClozeContentCursorOffset(number: number): number {
	return `{{c${number}::`.length;
}
