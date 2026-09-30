import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/dialog";
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/card';
import { Separator } from '@/components/separator';
import { ChevronDown, ChevronRight, Calendar, User, Building2, Wallet } from 'lucide-react';

type PayslipRow = {
  _id: string;
  employeeName: string;
  employeeCode?: string;
  taxCode?: string;
  grossEarnings: number;
  netSalary: number;
  pitAmount: number;
  taxableEarnings?: number;
  personalDeduction?: number;
  dependentDeduction?: number;
  contributionBase?: number;
  socialInsuranceRate?: number;
  healthInsuranceRate?: number;
  unemploymentInsuranceRate?: number;
  socialInsurance?: number;
  healthInsurance?: number;
  unemploymentInsurance?: number;
  earningBreakdown?: Array<{ type: string; label: string; amount: number; taxable?: boolean }>;
  allowanceBreakdown?: Array<{ type: string; label: string; amount: number; taxable?: boolean }>;
  otBreakdown?: {
    totalMinutes: number;
    workingDayMinutes: number;
    weeklyOffMinutes: number;
    publicHolidayMinutes: number;
    hourlyRate: number;
    otNonTaxable: number;
    otTaxable: number;
    otPay: number;
    breakdown: Array<{
      type: string;
      label: string;
      minutes: number;
      coefficient: number;
      amount: number;
      nonTaxable: number;
      taxable: number;
    }>;
  };
  deductionBreakdown?: Array<{ type: string; label: string; amount: number }>;
  pitBreakdown?: Array<{ bracket: number; income: number; rate: number; tax: number }>;
  dependents?: Array<{ fullName: string; relationship: string; birthDate?: string }>;
  status: string;
  generatedAt?: string;
  releasedAt?: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  payslip: PayslipRow | null;
  periodLabel: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const STATUS_LABELS: Record<string, string> = {
  GENERATED: 'Đã Tạo',
  RELEASED: 'Đã Phát Hành',
  VIEWED: 'Đã Xem',
};

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link' | 'success';

function getStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'VIEWED':
      return 'secondary';
    case 'RELEASED':
      return 'success';
    case 'GENERATED':
      return 'outline';
    default:
      return 'outline';
  }
}

export function PayslipPreviewDialog({ open, onClose, payslip, periodLabel }: Props) {
  const [showInsuranceDetail, setShowInsuranceDetail] = useState(false);
  const [showPitDetail, setShowPitDetail] = useState(false);

  if (!payslip) return null;

  const totalEarnings = payslip.grossEarnings || 0;
  const totalInsurance =
    (payslip.socialInsurance || 0) + (payslip.healthInsurance || 0) + (payslip.unemploymentInsurance || 0);
  const effectivePIT = payslip.pitAmount || 0;
  const totalDeductions = totalInsurance + effectivePIT;
  const netSalary = payslip.netSalary || 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bảng chi tiết lương - {periodLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-1">
          {/* Employee Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nhân viên</p>
                    <p className="mt-0.5 text-sm font-semibold">{payslip.employeeName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mã NV</p>
                    <p className="mt-0.5 font-mono text-sm">{payslip.employeeCode || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mã số thuế</p>
                    <p className="mt-0.5 font-mono text-sm">{payslip.taxCode || '—'}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">Trạng thái</span>
                <Badge variant={getStatusBadgeVariant(payslip.status)}>
                  {STATUS_LABELS[payslip.status] || payslip.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Gross Earnings */}
          <Card>
            <CardHeader>
              <CardTitle>Tổng thu nhập (Gross)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payslip.earningBreakdown?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-mono">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Tổng Gross</span>
                  <span className="font-mono text-lg">{formatCurrency(totalEarnings)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deductions */}
          <Card>
            <CardHeader>
              <CardTitle>Các khoản khấu trừ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Insurance summary */}
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Bảo hiểm (BHXH + BHYT + BHTN)</span>
                      {totalInsurance > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setShowInsuranceDetail(!showInsuranceDetail)}
                        >
                          {showInsuranceDetail ? (
                            <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          Chi tiết
                        </Button>
                      )}
                    </div>
                    <span className="font-mono text-sm font-medium text-destructive">
                      -{formatCurrency(totalInsurance)}
                    </span>
                  </div>
                  {showInsuranceDetail && totalInsurance > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {payslip.contributionBase && payslip.contributionBase > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Lương đóng BHXH</span>
                          <span className="font-mono">{formatCurrency(payslip.contributionBase)}</span>
                        </div>
                      )}
                      {(payslip.socialInsurance || 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">BHXH ({(payslip.socialInsuranceRate || 0) * 100}%)</span>
                          <span className="font-mono">-{formatCurrency(payslip.socialInsurance || 0)}</span>
                        </div>
                      )}
                      {(payslip.healthInsurance || 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">BHYT ({(payslip.healthInsuranceRate || 0) * 100}%)</span>
                          <span className="font-mono">-{formatCurrency(payslip.healthInsurance || 0)}</span>
                        </div>
                      )}
                      {(payslip.unemploymentInsurance || 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">BHTN ({(payslip.unemploymentInsuranceRate || 0) * 100}%)</span>
                          <span className="font-mono">-{formatCurrency(payslip.unemploymentInsurance || 0)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PIT summary */}
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">Thuế TNCN (PIT)</span>
                      {effectivePIT > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setShowPitDetail(!showPitDetail)}
                        >
                          {showPitDetail ? (
                            <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" aria-hidden="true" />
                          )}
                          Chi tiết
                        </Button>
                      )}
                    </div>
                    <span className="font-mono text-sm font-medium text-destructive">
                      -{formatCurrency(effectivePIT)}
                    </span>
                  </div>
                  {showPitDetail && effectivePIT > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Thu nhập chịu thuế</span>
                        <span className="font-mono">{formatCurrency(payslip.taxableEarnings || 0)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Giảm trừ bản thân</span>
                        <span className="font-mono">{formatCurrency(payslip.personalDeduction || 0)}</span>
                      </div>
                      {(payslip.dependents?.length || 0) > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Giảm trừ NPT ({payslip.dependents?.length} người)</span>
                          <span className="font-mono">{formatCurrency(payslip.dependentDeduction || 0)}</span>
                        </div>
                      )}
                      {payslip.pitBreakdown && payslip.pitBreakdown.length > 0 && (
                        <>
                          <Separator />
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Biểu thuế lũy tiến</p>
                          {payslip.pitBreakdown.map((bracket, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Bậc {bracket.bracket} ({bracket.rate}%)</span>
                              <span className="font-mono">{formatCurrency(bracket.tax)}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <Separator />
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Tổng khấu trừ</span>
                  <span className="font-mono text-lg text-destructive">-{formatCurrency(totalDeductions)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net Salary */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="font-semibold text-foreground">Lương thực nhận (Net)</span>
              </div>
              <span className="font-mono text-2xl font-bold text-primary">{formatCurrency(netSalary)}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground">
            {payslip.generatedAt && <p>Tạo: {formatDate(payslip.generatedAt)}</p>}
            {payslip.releasedAt && <p>Phát hành: {formatDate(payslip.releasedAt)}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
