export class TFile {}

export const Platform = { isDesktopApp: true };

export interface RequestUrlParam {
	url: string;
	method?: string;
	contentType?: string;
	body?: string | ArrayBuffer;
	headers?: Record<string, string>;
	throw?: boolean;
}

export interface RequestUrlResponse {
	status: number;
	headers: Record<string, string>;
	arrayBuffer: ArrayBuffer;
	json: unknown;
	text: string;
}

export async function requestUrl(_request: RequestUrlParam): Promise<RequestUrlResponse> {
	throw new Error('Tests must inject a request implementation.');
}
