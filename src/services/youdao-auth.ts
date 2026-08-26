export const YOUDAO_PC_COOKIE = 'YNOTE-PC';

const COOKIE_ATTRIBUTES = new Set(['domain', 'expires', 'httponly', 'max-age', 'partitioned', 'path', 'priority', 'samesite', 'secure']);

export interface YoudaoCredentialInput {
	ynotePc: string;
	sessionCookies: string;
	isCookieHeader: boolean;
}

export function extractCookieValue(cookieHeader: string, name: string): string | undefined {
	return parseCookiePairs(cookieHeader).find((cookie) => cookie.name === name)?.value;
}

export function normalizeYoudaoCredentialInput(value: string): YoudaoCredentialInput {
	const input = value.trim().replace(/^cookie:\s*/iu, '');
	const cookies = parseCookiePairs(input);
	const ynotePc = cookies.find((cookie) => cookie.name === YOUDAO_PC_COOKIE)?.value;
	const isBrowserCookieHeader = ynotePc !== undefined || cookies.some((cookie) => /^(?:P_INFO|YNOTE_(?:CSTK|LOGIN|PERS|SESS))$/u.test(cookie.name));
	if (!isBrowserCookieHeader) {
		return { ynotePc: value.trim(), sessionCookies: '', isCookieHeader: false };
	}
	return {
		ynotePc: ynotePc ?? '',
		sessionCookies: cookies
			.filter((cookie) => cookie.name !== YOUDAO_PC_COOKIE)
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; '),
		isCookieHeader: true,
	};
}

function parseCookiePairs(value: string): Array<{ name: string; value: string }> {
	const cookies: Array<{ name: string; value: string }> = [];
	for (const candidate of value.split(';')) {
		const separator = candidate.indexOf('=');
		if (separator < 1) {
			continue;
		}
		const name = candidate.slice(0, separator).trim();
		const cookieValue = candidate.slice(separator + 1).trim();
		if (name.length === 0 || cookieValue.length === 0 || COOKIE_ATTRIBUTES.has(name.toLowerCase())) {
			continue;
		}
		cookies.push({ name, value: cookieValue });
	}
	return cookies;
}
