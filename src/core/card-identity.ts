import { AnkiCardLinkError } from '../types';

export const CARD_UID_PATTERN = /^acl-[a-z0-9]{8}$/u;

export interface CardIdentity {
	uid: string;
	noteId?: number;
	linkLine?: number;
	legacyBlockId?: string;
}

export function isCardUid(value: string): boolean {
	return CARD_UID_PATTERN.test(value);
}

export function requireCardUid(value: string): string {
	if (!isCardUid(value)) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', `Invalid card UID: ${value}.`);
	}
	return value;
}

export function generateCardUid(randomUuid: () => string = () => crypto.randomUUID()): string {
	const compact = randomUuid().toLowerCase().replaceAll(/[^a-z0-9]/gu, '');
	if (compact.length < 8) {
		throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', 'Could not generate a stable card UID.');
	}
	return `acl-${compact.slice(0, 8)}`;
}
