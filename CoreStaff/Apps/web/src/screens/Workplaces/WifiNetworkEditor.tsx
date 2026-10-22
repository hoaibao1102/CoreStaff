import { Plus, Trash2, Wifi } from 'lucide-react';
import { Button } from '../../components/button';
import { Input } from '../../components/input';
import type { WifiNetworkRule } from '../../services/workplace.service';

const BSSID_PATTERN = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

/** `AA-BB-..` and `AA:BB:..` both become the canonical lower-case colon form. */
export function normalizeBssid(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, ':');
}

export function bssidError(value: string, rules: WifiNetworkRule[], index: number): string | null {
  const bssid = normalizeBssid(value);
  if (!bssid) return 'BSSID không được để trống.';
  if (!BSSID_PATTERN.test(bssid)) return 'BSSID phải có dạng aa:bb:cc:dd:ee:ff.';
  if (rules.some((rule, i) => i !== index && normalizeBssid(rule.bssid) === bssid)) return 'BSSID này đã có ở dòng khác.';
  return null;
}

export function emptyWifiRule(): WifiNetworkRule {
  return { label: '', ssid: '', bssid: '', active: true };
}

interface Props {
  rules: WifiNetworkRule[];
  onChange: (rules: WifiNetworkRule[]) => void;
  disabled?: boolean;
}

/**
 * Wi-Fi the mobile app may punch from. HR types the SSID for recognition and
 * the access point's BSSID, which is what the server actually verifies.
 */
export function WifiNetworkEditor({ rules, onChange, disabled }: Props) {
  const update = (index: number, patch: Partial<WifiNetworkRule>) =>
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  const add = () => onChange([...rules, emptyWifiRule()]);
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wifi className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Wi-Fi được phép chấm công</span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled || rules.length >= 50} className="h-9">
          <Plus className="mr-1.5 size-4" />Thêm Wi-Fi
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Chưa có Wi-Fi nào. Nhân viên sẽ chấm công bằng GPS hoặc ảnh selfie.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Tên gợi nhớ</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">SSID</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">BSSID (MAC access point)</th>
                <th className="w-16 px-3 py-2.5 text-center font-semibold text-muted-foreground">Bật</th>
                <th className="w-12 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, index) => {
                const error = bssidError(rule.bssid, rules, index);
                return (
                  <tr key={index} className="border-b border-border/50 last:border-0 align-top">
                    <td className="px-3 py-2">
                      <Input
                        className="h-9"
                        value={rule.label ?? ''}
                        placeholder="VD: Văn phòng Q1"
                        onChange={(e) => update(index, { label: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-9"
                        value={rule.ssid}
                        placeholder="VD: CoreStaff-Office"
                        onChange={(e) => update(index, { ssid: e.target.value })}
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className={`h-9 font-mono ${error ? 'border-destructive' : ''}`}
                        value={rule.bssid}
                        placeholder="aa:bb:cc:dd:ee:ff"
                        onChange={(e) => update(index, { bssid: e.target.value })}
                        onBlur={(e) => update(index, { bssid: normalizeBssid(e.target.value) })}
                        disabled={disabled}
                      />
                      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                        checked={rule.active}
                        onChange={(e) => update(index, { active: e.target.checked })}
                        disabled={disabled}
                        aria-label={`Bật Wi-Fi ${rule.ssid || index + 1}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        disabled={disabled}
                        className="h-8 w-8 p-0"
                        aria-label={`Xoá Wi-Fi ${rule.ssid || index + 1}`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        BSSID là địa chỉ MAC của access point — nhân viên đọc được trong phần thông tin Wi-Fi khi đứng tại văn phòng.
        SSID chỉ để dễ nhận biết, không dùng để xác thực.
      </p>
    </div>
  );
}
