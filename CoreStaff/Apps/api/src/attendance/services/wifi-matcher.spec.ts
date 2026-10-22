import { isWifiAllowed, normalizeBssid } from './wifi-matcher';

const rule = (bssid: string, active = true) => ({ ssid: 'Office', bssid, active });

describe('normalizeBssid', () => {
  it('lower-cases and converts dashes to colons', () => {
    expect(normalizeBssid(' AA-BB-CC-11-22-33 ')).toBe('aa:bb:cc:11:22:33');
  });
});

describe('isWifiAllowed', () => {
  it('matches a configured BSSID regardless of case or separator', () => {
    expect(isWifiAllowed('AA:BB:CC:11:22:33', [rule('aa-bb-cc-11-22-33')])).not.toBeNull();
  });

  it('returns null for an unknown BSSID', () => {
    expect(isWifiAllowed('aa:bb:cc:99:99:99', [rule('aa:bb:cc:11:22:33')])).toBeNull();
  });

  it('ignores inactive rules', () => {
    expect(isWifiAllowed('aa:bb:cc:11:22:33', [rule('aa:bb:cc:11:22:33', false)])).toBeNull();
  });

  it('returns null for an empty rule list or missing BSSID', () => {
    expect(isWifiAllowed('aa:bb:cc:11:22:33', [])).toBeNull();
    expect(isWifiAllowed(undefined, [rule('aa:bb:cc:11:22:33')])).toBeNull();
    expect(isWifiAllowed('   ', [rule('aa:bb:cc:11:22:33')])).toBeNull();
  });

  it('never matches on SSID alone', () => {
    const otherSsid = { ssid: 'Office', bssid: 'ff:ff:ff:ff:ff:ff', active: true };
    expect(isWifiAllowed('aa:bb:cc:11:22:33', [otherSsid])).toBeNull();
  });
});
