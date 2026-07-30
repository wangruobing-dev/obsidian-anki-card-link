import { requestUrl, type RequestUrlResponse } from 'obsidian';
import { validateAnkiConnectUrl } from '../settings';
import { AnkiCardLinkError } from '../types';
import { buildAnkiConnectRequestBody } from './anki-connect-request';

interface AnkiConnectResponse<T> {
	result: T | null;
	error: string | null;
}

interface RequestUrlLike {
	(request: Parameters<typeof requestUrl>[0]): Promise<RequestUrlResponse>;
}

export interface AnkiConnectServiceOptions {
	url: string;
	timeoutMs?: number;
	request?: RequestUrlLike;
}

export class AnkiConnectService {
	private readonly timeoutMs: number;
	private readonly request: RequestUrlLike;
	private readonly url: string;

	constructor(private readonly options: AnkiConnectServiceOptions) {
		this.timeoutMs = options.timeoutMs ?? 5_000;
		this.request = options.request ?? requestUrl;
		this.url = validateAnkiConnectUrl(options.url);
	}

	async guiBrowse(query: string): Promise<void> {
		await this.invoke<unknown[]>('guiBrowse', { query });
	}

	async testConnection(): Promise<void> {
		await this.invoke<number>('version', {});
	}

	private async invoke<T>(action: string, params: Record<string, unknown>): Promise<T> {
		const requestBody = buildAnkiConnectRequestBody(action, params);

		try {
			const response = await withTimeout(
				this.request({
					url: this.url,
					method: 'POST',
					contentType: 'application/json',
					body: JSON.stringify(requestBody),
					throw: false,
				}),
				this.timeoutMs,
			);

			if (response.status < 200 || response.status >= 300) {
				throw new AnkiCardLinkError(
					'ANKICONNECT_UNAVAILABLE',
					`AnkiConnect returned HTTP ${response.status}.`,
				);
			}

			const payload = parseResponse<T>(response.json);
			if (payload.error !== null) {
				throw new AnkiCardLinkError(
					'ANKICONNECT_ERROR',
					`AnkiConnect returned an error: ${payload.error}`,
				);
			}

			return payload.result as T;
		} catch (error) {
			if (error instanceof AnkiCardLinkError) {
				throw error;
			}

			if (error instanceof Error && error.message === 'REQUEST_TIMEOUT') {
				throw new AnkiCardLinkError(
					'ANKICONNECT_UNAVAILABLE',
					'AnkiConnect did not respond before the request timed out.',
					{ cause: error },
				);
			}

			throw new AnkiCardLinkError(
				'ANKI_NOT_RUNNING',
				'Anki is not running, or AnkiConnect is not installed or reachable.',
				{ cause: error },
			);
		}
	}
}

function parseResponse<T>(value: unknown): AnkiConnectResponse<T> {
	if (!isRecord(value) || !('result' in value) || !('error' in value)) {
		throw new AnkiCardLinkError(
			'ANKICONNECT_ERROR',
			'AnkiConnect returned an invalid response.',
		);
	}

	const error = value.error;
	if (error !== null && typeof error !== 'string') {
		throw new AnkiCardLinkError(
			'ANKICONNECT_ERROR',
			'AnkiConnect returned an invalid error value.',
		);
	}

	return { result: value.result as T | null, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeoutId: number | undefined;
	const timeout = new Promise<never>((_resolve, reject) => {
		timeoutId = window.setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
	});

	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
		}
	}
}
