import { NetworkValidatorService } from './network-validator.service';

describe('NetworkValidatorService', () => {
  let service: NetworkValidatorService;

  beforeEach(() => {
    service = new NetworkValidatorService();
  });

  it('should match exact single IP', () => {
    const rules = [{ cidrOrIp: '192.168.1.100', active: true }];
    expect(service.isIpAllowed('192.168.1.100', rules)).toBe(true);
    expect(service.isIpAllowed('192.168.1.101', rules)).toBe(false);
  });

  it('should match CIDR subnet /24', () => {
    const rules = [{ cidrOrIp: '192.168.1.0/24', active: true }];
    expect(service.isIpAllowed('192.168.1.5', rules)).toBe(true);
    expect(service.isIpAllowed('192.168.1.254', rules)).toBe(true);
    expect(service.isIpAllowed('192.168.2.1', rules)).toBe(false);
  });

  it('should match CIDR subnet /16 and /8', () => {
    const rules = [{ cidrOrIp: '10.0.0.0/8', active: true }];
    expect(service.isIpAllowed('10.20.30.40', rules)).toBe(true);
    expect(service.isIpAllowed('11.0.0.1', rules)).toBe(false);
  });

  it('should handle IPv6 mapped IPv4 address (::ffff:192.168.1.5)', () => {
    const rules = [{ cidrOrIp: '192.168.1.0/24', active: true }];
    expect(service.isIpAllowed('::ffff:192.168.1.5', rules)).toBe(true);
  });

  it('should ignore inactive rules', () => {
    const rules = [{ cidrOrIp: '192.168.1.100', active: false }];
    expect(service.isIpAllowed('192.168.1.100', rules)).toBe(false);
  });
});
