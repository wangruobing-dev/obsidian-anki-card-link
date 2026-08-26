import { describe, expect, it } from 'vitest';
import { extractCookieValue, normalizeYoudaoCredentialInput } from '../src/services/youdao-auth';

describe('extractCookieValue', () => {
	it('returns the named cookie value without changing its contents', () => {
		expect(extractCookieValue('YNOTE_SESS=session; YNOTE-PC=pc-value%3D; YNOTE_CSTK=cstk', 'YNOTE-PC')).toBe('pc-value%3D');
	});

	it('does not match a similarly named cookie or an empty value', () => {
		expect(extractCookieValue('MY-YNOTE-PC=wrong; YNOTE-PC=', 'YNOTE-PC')).toBeUndefined();
	});

	it('splits a copied browser cookie header into the persistent and session credentials', () => {
		expect(normalizeYoudaoCredentialInput('Cookie: YNOTE-PC=pc; YNOTE_SESS=session; YNOTE_LOGIN=login; Path=/; HttpOnly')).toEqual({
			ynotePc: 'pc',
			sessionCookies: 'YNOTE_SESS=session; YNOTE_LOGIN=login',
			isCookieHeader: true,
		});
	});

	it('accepts a prefixed single cookie and keeps a plain value unchanged', () => {
		expect(normalizeYoudaoCredentialInput('YNOTE-PC=pc')).toMatchObject({ ynotePc: 'pc', sessionCookies: '', isCookieHeader: true });
		expect(normalizeYoudaoCredentialInput('pc-value')).toMatchObject({ ynotePc: 'pc-value', sessionCookies: '', isCookieHeader: false });
	});

	it('accepts a browser cookie header that does not expose HttpOnly YNOTE-PC', () => {
		expect(normalizeYoudaoCredentialInput('P_INFO=account; YNOTE_SESS=session; YNOTE_LOGIN=login; YNOTE_CSTK=cstk')).toEqual({
			ynotePc: '',
			sessionCookies: 'P_INFO=account; YNOTE_SESS=session; YNOTE_LOGIN=login; YNOTE_CSTK=cstk',
			isCookieHeader: true,
		});
	});
});
