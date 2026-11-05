import 'dart:async';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/error/app_exception.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/attendance_repository.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_bloc.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_event.dart';
import 'package:corestaff_mobile/features/overview/presentation/bloc/overview_state.dart';
import 'package:corestaff_mobile/features/payslip/data/models/payslip_dto.dart';
import 'package:corestaff_mobile/features/payslip/data/payslip_repository.dart';
import 'package:corestaff_mobile/features/requests/data/models/leave_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/models/overtime_request_dto.dart';
import 'package:corestaff_mobile/features/requests/data/requests_repository.dart';

class MockAttendanceRepository extends Mock implements AttendanceRepository {}
class MockRequestsRepository extends Mock implements RequestsRepository {}
class MockPayslipRepository extends Mock implements PayslipRepository {}

void main() {
  late MockAttendanceRepository mockAttendance;
  late MockRequestsRepository mockRequests;
  late MockPayslipRepository mockPayslips;

  const sampleAssignment = AttendanceAssignmentDto(
    shiftName: 'Ca tiêu chuẩn',
    shiftHours: '08:00 - 17:00',
    startTime: '08:00',
    endTime: '17:00',
    workplaceName: 'Trụ sở chính',
    address: 'Hà Nội',
  );

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T08:00:00.000Z',
    attendanceStatus: 'IN_PROGRESS',
    availableAction: 'CHECK_OUT',
    workingMinutes: 120,
    assignment: sampleAssignment,
  );

  const sampleLeaves = [
    LeaveRequestDto(
      id: 'l_pending_mgr',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      leaveType: 'ANNUAL',
      durationType: 'FULL_DAY',
      reason: 'Lý do nghỉ phép cá nhân',
      status: 'PENDING_MANAGER',
    ),
    LeaveRequestDto(
      id: 'l_pending',
      startDate: '2026-11-11',
      endDate: '2026-11-11',
      leaveType: 'ANNUAL',
      durationType: 'FULL_DAY',
      reason: 'Lý do nghỉ phép cá nhân',
      status: 'PENDING',
    ),
    LeaveRequestDto(
      id: 'l_approved',
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      leaveType: 'ANNUAL',
      durationType: 'FULL_DAY',
      reason: 'Đã duyệt xong',
      status: 'APPROVED',
    ),
  ];

  const sampleOvertime = [
    OvertimeRequestDto(
      id: 'ot_pending',
      workDate: '2026-11-05',
      reason: 'Làm thêm báo cáo quý',
      status: 'PENDING',
    ),
    OvertimeRequestDto(
      id: 'ot_clarification',
      workDate: '2026-11-06',
      reason: 'Cần giải trình công việc',
      status: 'CLARIFICATION_REQUESTED',
    ),
    OvertimeRequestDto(
      id: 'ot_rejected',
      workDate: '2026-11-02',
      reason: 'Từ chối duyệt',
      status: 'REJECTED',
    ),
  ];

  const samplePayslips = [
    PayslipDto(
      id: 'p_rel_1',
      periodLabel: '10/2026',
      status: 'RELEASED',
      grossEarnings: 25000000,
      netSalary: 22000000,
      socialInsurance: 2000000,
      healthInsurance: 375000,
      unemploymentInsurance: 250000,
      pitAmount: 375000,
      otherDeductions: 0,
    ),
    PayslipDto(
      id: 'p_rel_2',
      periodLabel: '09/2026',
      status: 'RELEASED',
      grossEarnings: 25000000,
      netSalary: 22000000,
      socialInsurance: 2000000,
      healthInsurance: 375000,
      unemploymentInsurance: 250000,
      pitAmount: 375000,
      otherDeductions: 0,
    ),
    PayslipDto(
      id: 'p_viewed',
      periodLabel: '08/2026',
      status: 'VIEWED',
      grossEarnings: 25000000,
      netSalary: 22000000,
      socialInsurance: 2000000,
      healthInsurance: 375000,
      unemploymentInsurance: 250000,
      pitAmount: 375000,
      otherDeductions: 0,
    ),
  ];

  setUp(() {
    mockAttendance = MockAttendanceRepository();
    mockRequests = MockRequestsRepository();
    mockPayslips = MockPayslipRepository();
  });

  group('Adversarial Suite: Partial Failure Isolation (Combinatorics of 1, 2, and 3 failing endpoints)', () {
    // --- 1 ENDPOINT FAILS ---
    blocTest<OverviewBloc, OverviewState>(
      '1/4 endpoints fail: Only Attendance fails -> Leaves, OT, Payslips data preserved, partialError recorded',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(
          const ApiException(code: 'ATTENDANCE_LOCKED', statusCode: 400, message: 'Kỳ công đã khóa'),
        );
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4) // 2 leaves + 2 ot
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2) // 2 RELEASED
            .having((s) => s.partialError, 'partialError', contains('Kỳ công đã khóa')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '1/4 endpoints fail: Only Leaves fails -> Attendance, OT, Payslips preserved; pendingRequests counts OT only',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(
          const NetworkException('Mất kết nối máy chủ xin phép'),
        );
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 2) // 2 OT pending
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', contains('Mất kết nối máy chủ xin phép')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '1/4 endpoints fail: Only Overtime fails -> Attendance, Leaves, Payslips preserved; pendingRequests counts Leaves only',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(
          const ApiException(code: 'FORBIDDEN', statusCode: 403, message: 'Không có quyền truy cập OT'),
        );
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 2) // 2 leaves pending
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', contains('Không có quyền truy cập OT')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '1/4 endpoints fail: Only Payslips fails -> Attendance, Leaves, OT preserved; newPayslips defaults to 0',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenThrow(
          const ApiException(code: 'PAYSLIP_NOT_FOUND_OR_NOT_ACCESSIBLE', statusCode: 404, message: 'Lỗi phiếu lương'),
        );
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 0)
            .having((s) => s.partialError, 'partialError', contains('Phiếu lương không tồn tại')),
      ],
    );

    // --- 2 ENDPOINTS FAIL ---
    blocTest<OverviewBloc, OverviewState>(
      '2/4 endpoints fail: Attendance + Payslips fail -> Leaves and OT live data preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(Exception('Lỗi attendance'));
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenThrow(Exception('Lỗi payslip'));
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 0)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '2/4 endpoints fail: Leaves + OT fail -> Attendance and Payslips live data preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(Exception('Lỗi Leaves'));
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(Exception('Lỗi OT'));
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 0)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '2/4 endpoints fail: Attendance + Leaves fail -> OT and Payslips live data preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(Exception('Lỗi Attendance'));
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(Exception('Lỗi Leaves'));
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 2)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );

    // --- 3 ENDPOINTS FAIL ---
    blocTest<OverviewBloc, OverviewState>(
      '3/4 endpoints fail: Leaves + OT + Payslips fail -> Only Attendance preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(Exception('Leaves down'));
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(Exception('OT down'));
        when(() => mockPayslips.getMyPayslips()).thenThrow(Exception('Payslips down'));
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 0)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 0)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '3/4 endpoints fail: Attendance + Leaves + OT fail -> Only Payslips preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(Exception('Att down'));
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(Exception('Leaves down'));
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(Exception('OT down'));
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 0)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      '3/4 endpoints fail: Attendance + OT + Payslips fail -> Only Leaves preserved',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(Exception('Att down'));
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(Exception('OT down'));
        when(() => mockPayslips.getMyPayslips()).thenThrow(Exception('Payslips down'));
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 2)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 0)
            .having((s) => s.partialError, 'partialError', isNotNull),
      ],
    );
  });

  group('Adversarial Suite: Total Failure & Recovery Lifecycle', () {
    blocTest<OverviewBloc, OverviewState>(
      'Total failure on initial load with heterogeneous exceptions emits OverviewError with first resolved message',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(
          const ApiException(code: 'ASSIGNMENT_NOT_CONFIGURED', statusCode: 400, message: 'Chưa phân ca'),
        );
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(
          const NetworkException('Mất kết nối'),
        );
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(
          const FormatException('Malformed response'),
        );
        when(() => mockPayslips.getMyPayslips()).thenThrow(
          TimeoutException('Payslip timeout'),
        );
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewError>().having((s) => s.message, 'message', contains('chưa được phân ca')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Recovery lifecycle: from OverviewError, retrying LoadOverview transitions to OverviewLoading then OverviewLoaded on recovery',
      seed: () => const OverviewError(message: 'Lỗi máy chủ tạm thời'),
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', isNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Total failure during pull-to-refresh on loaded state preserves cached screen data and displays partialError banner',
      seed: () => const OverviewLoaded(
        todayAttendance: sampleToday,
        pendingRequestsCount: 4,
        newPayslipsCount: 2,
      ),
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(const NetworkException('Mất mạng đột ngột'));
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(const NetworkException('Mất mạng đột ngột'));
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(const NetworkException('Mất mạng đột ngột'));
        when(() => mockPayslips.getMyPayslips()).thenThrow(const NetworkException('Mất mạng đột ngột'));
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const RefreshOverview()),
      expect: () => [
        isA<OverviewLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', true)
            .having((s) => s.partialError, 'partialError', isNull),
        isA<OverviewLoaded>()
            .having((s) => s.isRefreshing, 'isRefreshing', false)
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance preserved', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount preserved', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount preserved', 2)
            .having((s) => s.partialError, 'partialError', contains('Mất mạng đột ngột')),
      ],
    );
  });

  group('Adversarial Suite: Attention Counters Boundary & Scale Stress Testing', () {
    blocTest<OverviewBloc, OverviewState>(
      'Boundary zero: 0 leaves, 0 OT, 0 payslips produces exactly 0 counters',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => []);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => []);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => []);
        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount is 0', 0)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount is 0', 0),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Boundary scale: 100 leaves + 100 OT + 100 payslips accurately filtered by domain status',
      build: () {
        // Generate 100 leaves: 30 PENDING_MANAGER, 20 PENDING, 25 APPROVED, 15 REJECTED, 10 CANCELLED
        final stressLeaves = List.generate(100, (i) {
          String st;
          if (i < 30) {
            st = 'PENDING_MANAGER';
          } else if (i < 50) {
            st = 'PENDING';
          } else if (i < 75) {
            st = 'APPROVED';
          } else if (i < 90) {
            st = 'REJECTED';
          } else {
            st = 'CANCELLED';
          }
          return LeaveRequestDto(
            id: 'l_$i',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            leaveType: 'ANNUAL',
            durationType: 'FULL_DAY',
            reason: 'Stress test reason $i',
            status: st,
          );
        });

        // Generate 100 OT: 35 PENDING, 15 CLARIFICATION_REQUESTED, 30 APPROVED, 20 REJECTED
        final stressOT = List.generate(100, (i) {
          String st;
          if (i < 35) {
            st = 'PENDING';
          } else if (i < 50) {
            st = 'CLARIFICATION_REQUESTED';
          } else if (i < 80) {
            st = 'APPROVED';
          } else {
            st = 'REJECTED';
          }
          return OvertimeRequestDto(
            id: 'ot_$i',
            workDate: '2026-11-05',
            reason: 'Stress test reason $i',
            status: st,
          );
        });

        // Generate 100 Payslips: 42 RELEASED, 38 VIEWED, 20 DRAFT
        final stressPayslips = List.generate(100, (i) {
          String st;
          if (i < 42) {
            st = 'RELEASED';
          } else if (i < 80) {
            st = 'VIEWED';
          } else {
            st = 'DRAFT';
          }
          return PayslipDto(
            id: 'p_$i',
            periodLabel: '$i/2026',
            status: st,
            grossEarnings: 10000000,
            netSalary: 9000000,
            socialInsurance: 800000,
            healthInsurance: 150000,
            unemploymentInsurance: 100000,
            pitAmount: 0,
            otherDeductions: 0,
          );
        });

        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => stressLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => stressOT);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => stressPayslips);

        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            // Expected pending requests: (30 + 20 leaves) + (35 + 15 ot) = 50 + 50 = 100
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount is exactly 100', 100)
            // Expected new payslips: 42 RELEASED
            .having((s) => s.newPayslipsCount, 'newPayslipsCount is exactly 42', 42),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Strict status whitelist: ignores casing variants, unknown statuses, and empty strings',
      build: () {
        const weirdLeaves = [
          LeaveRequestDto(
            id: 'wl1',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            leaveType: 'ANNUAL',
            durationType: 'FULL_DAY',
            reason: 'Test reason',
            status: 'pending', // lowercase - should NOT match
          ),
          LeaveRequestDto(
            id: 'wl2',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            leaveType: 'ANNUAL',
            durationType: 'FULL_DAY',
            reason: 'Test reason',
            status: 'PENDING_HR', // not manager - should NOT match
          ),
          LeaveRequestDto(
            id: 'wl3',
            startDate: '2026-11-10',
            endDate: '2026-11-10',
            leaveType: 'ANNUAL',
            durationType: 'FULL_DAY',
            reason: 'Test reason',
            status: 'PENDING', // exact - should match
          ),
        ];

        const weirdOT = [
          OvertimeRequestDto(
            id: 'wo1',
            workDate: '2026-11-05',
            reason: 'Test reason',
            status: 'pending', // lowercase - should NOT match
          ),
          OvertimeRequestDto(
            id: 'wo2',
            workDate: '2026-11-05',
            reason: 'Test reason',
            status: 'CLARIFICATION', // incomplete - should NOT match
          ),
          OvertimeRequestDto(
            id: 'wo3',
            workDate: '2026-11-05',
            reason: 'Test reason',
            status: 'CLARIFICATION_REQUESTED', // exact - should match
          ),
        ];

        const weirdPayslips = [
          PayslipDto(
            id: 'wp1',
            periodLabel: '10/2026',
            status: 'released', // lowercase - should NOT match
            grossEarnings: 1000,
            netSalary: 1000,
            socialInsurance: 0,
            healthInsurance: 0,
            unemploymentInsurance: 0,
            pitAmount: 0,
            otherDeductions: 0,
          ),
          PayslipDto(
            id: 'wp2',
            periodLabel: '10/2026',
            status: 'RELEASED', // exact - should match
            grossEarnings: 1000,
            netSalary: 1000,
            socialInsurance: 0,
            healthInsurance: 0,
            unemploymentInsurance: 0,
            pitAmount: 0,
            otherDeductions: 0,
          ),
        ];

        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => weirdLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => weirdOT);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => weirdPayslips);

        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount is 1 leaf + 1 ot = 2', 2)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount is 1 released = 1', 1),
      ],
    );
  });

  group('Adversarial Suite: Concurrency Settling, Asynchronous Latencies & Rejection Types', () {
    blocTest<OverviewBloc, OverviewState>(
      'Handles asynchronous latency jitter without race conditions (fast failure + slow success)',
      build: () {
        // Attendance takes 150ms and succeeds
        when(() => mockAttendance.getTodayAttendance()).thenAnswer(
          (_) async => Future.delayed(const Duration(milliseconds: 150), () => sampleToday),
        );
        // Leaves fails quickly in 20ms
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer(
          (_) async => Future.delayed(
            const Duration(milliseconds: 20),
            () => throw const NetworkException('Fast failure on leaves'),
          ),
        );
        // OT succeeds in 100ms
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer(
          (_) async => Future.delayed(const Duration(milliseconds: 100), () => sampleOvertime),
        );
        // Payslips succeeds in 50ms
        when(() => mockPayslips.getMyPayslips()).thenAnswer(
          (_) async => Future.delayed(const Duration(milliseconds: 50), () => samplePayslips),
        );

        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      wait: const Duration(milliseconds: 300),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance?.workDate, 'todayAttendance', '2026-11-04')
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 2) // 2 OT pending
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2) // 2 payslips
            .having((s) => s.partialError, 'partialError', contains('Fast failure on leaves')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Synchronously thrown exceptions do not leak outside BLoC or crash the event handler',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(
          StateError('Synchronous fatal state error in repository!'),
        );
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);

        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) => bloc.add(const LoadOverview()),
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>()
            .having((s) => s.todayAttendance, 'todayAttendance is null', isNull)
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError is handled', isNotNull),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'Rapid sequential event dispatch (LoadOverview then RefreshOverview) stabilizes to loaded state',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenAnswer((_) async => samplePayslips);

        return OverviewBloc(
          attendanceRepository: mockAttendance,
          requestsRepository: mockRequests,
          payslipRepository: mockPayslips,
        );
      },
      act: (bloc) {
        bloc.add(const LoadOverview());
        bloc.add(const RefreshOverview());
      },
      expect: () => [
        isA<OverviewLoading>(),
        isA<OverviewLoaded>().having((s) => s.isRefreshing, 'isRefreshing', false),
        isA<OverviewLoaded>().having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<OverviewLoaded>().having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
    );
  });
}
