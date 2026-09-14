/** Extract a single cookie value from a raw `Cookie` header string. */
export function getCookie(raw: string | undefined, name: string): string | undefined {
	if (!raw) return undefined;
	const prefix = name + '=';
	for (const part of raw.split(';')) {
		const p = part.trim();
		if (p.startsWith(prefix)) return decodeURIComponent(p.slice(prefix.length));
	}
	return undefined;
}
