/**
 * 生成跨平台 SHA-256 指纹。优先使用 Web Crypto，并在旧运行环境中回退到纯 TypeScript 实现。
 */
export async function sha256Hex(parts: readonly ArrayBuffer[]): Promise<string> {
	const bytes = joinParts(parts);
	const subtle = typeof window === 'undefined' ? undefined : window.crypto?.subtle;
	if (subtle !== undefined) {
		const digest = await subtle.digest('SHA-256', bytes.buffer as ArrayBuffer);
		return toHex(new Uint8Array(digest));
	}
	return toHex(sha256(bytes));
}

export function utf8Bytes(value: string): ArrayBuffer {
	return new TextEncoder().encode(value).buffer;
}

export function lengthPrefixedBytes(value: ArrayBuffer): ArrayBuffer {
	const source = new Uint8Array(value);
	const result = new Uint8Array(4 + source.byteLength);
	new DataView(result.buffer).setUint32(0, source.byteLength, false);
	result.set(source, 4);
	return result.buffer;
}

function joinParts(parts: readonly ArrayBuffer[]): Uint8Array {
	const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		const bytes = new Uint8Array(part);
		result.set(bytes, offset);
		offset += bytes.byteLength;
	}
	return result;
}

function sha256(input: Uint8Array): Uint8Array {
	const bitLength = input.byteLength * 8;
	const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(input);
	padded[input.byteLength] = 0x80;
	const view = new DataView(padded.buffer);
	view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
	view.setUint32(paddedLength - 4, bitLength >>> 0, false);

	let state0 = 0x6a09e667;
	let state1 = 0xbb67ae85;
	let state2 = 0x3c6ef372;
	let state3 = 0xa54ff53a;
	let state4 = 0x510e527f;
	let state5 = 0x9b05688c;
	let state6 = 0x1f83d9ab;
	let state7 = 0x5be0cd19;
	const words = new Uint32Array(64);
	for (let blockOffset = 0; blockOffset < paddedLength; blockOffset += 64) {
		for (let index = 0; index < 16; index += 1) {
			words[index] = view.getUint32(blockOffset + index * 4, false);
		}
		for (let index = 16; index < 64; index += 1) {
			const word15 = words[index - 15] ?? 0;
			const word2 = words[index - 2] ?? 0;
			words[index] = (smallSigma1(word2) + (words[index - 7] ?? 0) + smallSigma0(word15) + (words[index - 16] ?? 0)) >>> 0;
		}
		let value0 = state0;
		let value1 = state1;
		let value2 = state2;
		let value3 = state3;
		let value4 = state4;
		let value5 = state5;
		let value6 = state6;
		let value7 = state7;
		for (let index = 0; index < 64; index += 1) {
			const temporary1 = (value7 + bigSigma1(value4) + choose(value4, value5, value6) + SHA256_CONSTANTS[index]! + (words[index] ?? 0)) >>> 0;
			const temporary2 = (bigSigma0(value0) + majority(value0, value1, value2)) >>> 0;
			value7 = value6;
			value6 = value5;
			value5 = value4;
			value4 = (value3 + temporary1) >>> 0;
			value3 = value2;
			value2 = value1;
			value1 = value0;
			value0 = (temporary1 + temporary2) >>> 0;
		}
		state0 = (state0 + value0) >>> 0;
		state1 = (state1 + value1) >>> 0;
		state2 = (state2 + value2) >>> 0;
		state3 = (state3 + value3) >>> 0;
		state4 = (state4 + value4) >>> 0;
		state5 = (state5 + value5) >>> 0;
		state6 = (state6 + value6) >>> 0;
		state7 = (state7 + value7) >>> 0;
	}
	const result = new Uint8Array(32);
	const resultView = new DataView(result.buffer);
	[state0, state1, state2, state3, state4, state5, state6, state7].forEach((value, index) => resultView.setUint32(index * 4, value, false));
	return result;
}

function choose(value0: number, value1: number, value2: number): number {
	return (value0 & value1) ^ (~value0 & value2);
}

function majority(value0: number, value1: number, value2: number): number {
	return (value0 & value1) ^ (value0 & value2) ^ (value1 & value2);
}

function bigSigma0(value: number): number {
	return rotateRight(value, 2) ^ rotateRight(value, 13) ^ rotateRight(value, 22);
}

function bigSigma1(value: number): number {
	return rotateRight(value, 6) ^ rotateRight(value, 11) ^ rotateRight(value, 25);
}

function smallSigma0(value: number): number {
	return rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
}

function smallSigma1(value: number): number {
	return rotateRight(value, 17) ^ rotateRight(value, 19) ^ (value >>> 10);
}

function rotateRight(value: number, amount: number): number {
	return (value >>> amount) | (value << (32 - amount));
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

const SHA256_CONSTANTS = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;
