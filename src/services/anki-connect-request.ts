export interface AnkiConnectRequestBody {
	action: string;
	version: 6;
	params: Record<string, unknown>;
}

export function buildAnkiConnectRequestBody(
	action: string,
	params: Record<string, unknown>,
): AnkiConnectRequestBody {
	return { action, version: 6, params };
}
