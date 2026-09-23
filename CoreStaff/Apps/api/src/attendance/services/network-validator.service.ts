import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class NetworkValidatorService {
  /**
   * Trích xuất client IP thực tế từ HTTP Request, có xử lý reverse proxy (X-Forwarded-For).
   */
  extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const forwardedIps = typeof forwarded === 'string' ? forwarded : forwarded[0];
      const clientIp = forwardedIps.split(',')[0].trim();
      if (clientIp) return this.normalizeIp(clientIp);
    }
    const remoteIp = req.socket?.remoteAddress || req.ip || '';
    return this.normalizeIp(remoteIp);
  }

  /**
   * Kiểm tra xem client IP có khớp với bất kỳ địa chỉ IP hoặc CIDR nào trong danh sách cho phép.
   */
  isIpAllowed(clientIp: string, allowedNetworks: Array<{ cidrOrIp: string; active?: boolean }>): boolean {
    const normalizedClient = this.normalizeIp(clientIp);
    if (!normalizedClient) return false;

    // Trong môi trường Localhost/Dev: 127.0.0.1 hoặc ::1 luôn cho phép nếu có cấu hình localhost
    const activeRules = allowedNetworks.filter((n) => n.active !== false);
    if (activeRules.length === 0) {
      return false;
    }

    for (const rule of activeRules) {
      const target = rule.cidrOrIp.trim();
      if (!target) continue;

      if (target.includes('/')) {
        if (this.isIpInCidr(normalizedClient, target)) return true;
      } else {
        if (this.normalizeIp(target) === normalizedClient) return true;
      }
    }

    return false;
  }

  private normalizeIp(ip: string): string {
    let clean = ip.trim();
    if (clean.startsWith('::ffff:')) {
      clean = clean.substring(7);
    }
    return clean;
  }

  /**
   * Kiểm tra IPv4 có nằm trong dải CIDR (ví dụ: 192.168.1.5 trong 192.168.1.0/24)
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);
      if (isNaN(bits) || bits < 0 || bits > 32) return false;

      const ipNum = this.ipv4ToNumber(ip);
      const rangeNum = this.ipv4ToNumber(range);
      if (ipNum === null || rangeNum === null) return false;

      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  private ipv4ToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let num = 0;
    for (const part of parts) {
      const octet = parseInt(part, 10);
      if (isNaN(octet) || octet < 0 || octet > 255) return null;
      num = (num << 8) + octet;
    }
    return num >>> 0;
  }
}
