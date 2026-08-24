export function buildWordFileName(title: string): string {
	const safeTitle = title.replace(/[\\/:*?"<>|]+/gu, '-').replace(/\s+/gu, ' ').trim().replace(/[.\- ]+$/gu, '');
	return `${safeTitle.length === 0 ? 'note' : safeTitle}.docx`;
}
