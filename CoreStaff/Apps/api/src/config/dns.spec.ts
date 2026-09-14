import * as dns from 'node:dns';
import { ensureSrvCapableResolver } from './dns';

jest.mock('node:dns');

const mocked = dns as unknown as {
	getServers: jest.Mock<string[], []>;
	setServers: jest.Mock<void, [string[]]>;
};

describe('ensureSrvCapableResolver', () => {
	beforeEach(() => {
		mocked.getServers.mockReset();
		mocked.setServers.mockReset();
	});

	it('repoints when the only nameserver is a loopback stub', () => {
		mocked.getServers.mockReturnValue(['127.0.0.1']);
		expect(ensureSrvCapableResolver()).toBe(true);
		expect(mocked.setServers).toHaveBeenCalledWith(['8.8.8.8', '1.1.1.1']);
	});

	it('is a no-op on a real resolver', () => {
		mocked.getServers.mockReturnValue(['192.168.1.1']);
		expect(ensureSrvCapableResolver()).toBe(false);
		expect(mocked.setServers).not.toHaveBeenCalled();
	});

	it('does NOT treat the AWS/Vercel 169.254.172.12 resolver as a stub', () => {
		mocked.getServers.mockReturnValue(['169.254.172.12']);
		expect(ensureSrvCapableResolver()).toBe(false);
		expect(mocked.setServers).not.toHaveBeenCalled();
	});

	it('repoints only when EVERY server is local (mixed → trust the system)', () => {
		mocked.getServers.mockReturnValue(['127.0.0.1', '8.8.4.4']);
		expect(ensureSrvCapableResolver()).toBe(false);
		expect(mocked.setServers).not.toHaveBeenCalled();
	});

	it('is a no-op when no servers are configured', () => {
		mocked.getServers.mockReturnValue([]);
		expect(ensureSrvCapableResolver()).toBe(false);
		expect(mocked.setServers).not.toHaveBeenCalled();
	});
});
