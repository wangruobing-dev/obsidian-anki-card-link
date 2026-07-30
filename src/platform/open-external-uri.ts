export async function openExternalUri(uri: string): Promise<void> {
	const openedWindow = window.open(uri, '_blank', 'noopener,noreferrer');
	if (openedWindow === null) {
		throw new Error('The operating system rejected the external URI.');
	}
}
