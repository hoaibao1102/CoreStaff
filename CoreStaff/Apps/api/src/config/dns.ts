import * as dns from 'node:dns';

/** Public resolvers used when the system resolver can't answer SRV queries. */
const FALLBACK_SERVERS = ['8.8.8.8', '1.1.1.1'];

/**
 * Some local stub resolvers (VPN client, Docker Desktop, security suites listen
 * on 127.0.0.1) refuse `_mongodb._tcp.*` SRV lookups with ECONNREFUSED, which
 * breaks `mongodb+srv://` connection strings while plain TCP egress is fine.
 *
 * If every configured nameserver is a loopback/link-local stub, point Node's
 * resolver at public DNS instead. No-op when the system already uses a real
 * resolver, so production/serverless behaviour is unchanged.
 */
export function ensureSrvCapableResolver(): boolean {
	const servers = dns.getServers();
	const onlyStub = servers.length > 0 && servers.every(isLocalStub);
	if (!onlyStub) return false;

	dns.setServers(FALLBACK_SERVERS);
	// eslint-disable-next-line no-console
	console.log(`[env] system DNS ${servers.join(', ')} cannot resolve SRV — using public resolver for this process`);
	return true;
}

function isLocalStub(server: string): boolean {
	// Deliberately narrow: loopback/link-local only. 169.254.172.12 is the AWS
	// Lambda / Vercel Route 53 resolver — a real, SRV-capable one — so it must
	// NOT be treated as a stub here.
	return server.startsWith('127.') || server === '::1' || server.startsWith('fe80');
}
