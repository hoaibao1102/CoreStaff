import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
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
    shiftName: 'Ca hành chính',
    shiftHours: '08:00 - 17:00',
    startTime: '08:00',
    endTime: '17:00',
    workplaceName: 'Bitexco',
    address: 'Q1, TP.HCM',
  );

  const sampleToday = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'CHECKED_IN',
    availableAction: 'CHECK_OUT',
    workingMinutes: 240,
    lateMinutes: 0,
    earlyMinutes: 0,
    assignment: sampleAssignment,
  );

  const sampleLeaves = [
    LeaveRequestDto(
      id: 'l1',
      startDate: '2026-11-10',
      endDate: '2026-11-10',
      leaveType: 'PAID_LEAVE',
      durationType: 'FULL_DAY',
      reason: 'Bận việc gia đình',
      status: 'PENDING_MANAGER',
    ),
    LeaveRequestDto(
      id: 'l2',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
      leaveType: 'PAID_LEAVE',
      durationType: 'FULL_DAY',
      reason: 'Khám sức khỏe',
      status: 'PENDING',
    ),
    LeaveRequestDto(
      id: 'l3',
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      leaveType: 'PAID_LEAVE',
      durationType: 'FULL_DAY',
      reason: 'Đã duyệt',
      status: 'APPROVED',
    ),
  ];

  const sampleOvertime = [
    OvertimeRequestDto(
      id: 'o1',
      workDate: '2026-11-05',
      reason: 'Hoàn thành dự án sprint 4',
      status: 'PENDING',
    ),
    OvertimeRequestDto(
      id: 'o2',
      workDate: '2026-11-06',
      reason: 'Cần giải trình thêm',
      status: 'CLARIFICATION_REQUESTED',
    ),
    OvertimeRequestDto(
      id: 'o3',
      workDate: '2026-11-02',
      reason: 'Đã duyệt',
      status: 'APPROVED',
    ),
  ];

  const samplePayslips = [
    PayslipDto(
      id: 'p1',
      periodLabel: '10/2026',
      status: 'RELEASED',
      grossEarnings: 20000000,
      netSalary: 18000000,
      socialInsurance: 1600000,
      healthInsurance: 300000,
      unemploymentInsurance: 100000,
      pitAmount: 0,
      otherDeductions: 0,
    ),
    PayslipDto(
      id: 'p2',
      periodLabel: '09/2026',
      status: 'RELEASED',
      grossEarnings: 20000000,
      netSalary: 18000000,
      socialInsurance: 1600000,
      healthInsurance: 300000,
      unemploymentInsurance: 100000,
      pitAmount: 0,
      otherDeductions: 0,
    ),
    PayslipDto(
      id: 'p3',
      periodLabel: '08/2026',
      status: 'VIEWED',
      grossEarnings: 20000000,
      netSalary: 18000000,
      socialInsurance: 1600000,
      healthInsurance: 300000,
      unemploymentInsurance: 100000,
      pitAmount: 0,
      otherDeductions: 0,
    ),
  ];

  setUp(() {
    mockAttendance = MockAttendanceRepository();
    mockRequests = MockRequestsRepository();
    mockPayslips = MockPayslipRepository();
  });

  group('OverviewBloc Unit Tests', () {
    test('initial state is OverviewInitial', () {
      final bloc = OverviewBloc(
        attendanceRepository: mockAttendance,
        requestsRepository: mockRequests,
        payslipRepository: mockPayslips,
      );
      expect(bloc.state, isA<OverviewInitial>());
    });

    blocTest<OverviewBloc, OverviewState>(
      'settled concurrency full success calculates counters and displays today shift',
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
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4) // 2 leaves + 2 ot
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2) // 2 RELEASED
            .having((s) => s.partialError, 'partialError', isNull)
            .having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'partial failure (payslip down) preserves attendance & requests data and records partialError',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenAnswer((_) async => sampleToday);
        when(() => mockRequests.getMyLeaveRequests()).thenAnswer((_) async => sampleLeaves);
        when(() => mockRequests.getMyOvertimeRequests()).thenAnswer((_) async => sampleOvertime);
        when(() => mockPayslips.getMyPayslips()).thenThrow(
          const ApiException(
            code: 'INTERNAL_ERROR',
            statusCode: 500,
            message: 'Dịch vụ phiếu lương tạm thời gián đoạn',
          ),
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
            .having((s) => s.partialError, 'partialError', contains('Dịch vụ phiếu lương')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'partial failure (attendance unassigned) preserves requests & payslips with placeholder shift',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(
          const ApiException(
            code: 'ASSIGNMENT_NOT_CONFIGURED',
            statusCode: 400,
            message: 'Chưa phân ca',
          ),
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
            .having((s) => s.pendingRequestsCount, 'pendingRequestsCount', 4)
            .having((s) => s.newPayslipsCount, 'newPayslipsCount', 2)
            .having((s) => s.partialError, 'partialError', contains('chưa được phân ca')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'total failure on initial load emits OverviewError',
      build: () {
        when(() => mockAttendance.getTodayAttendance()).thenThrow(
          const ApiException(
            code: 'NETWORK_ERROR',
            statusCode: 503,
            message: 'Không thể kết nối máy chủ',
          ),
        );
        when(() => mockRequests.getMyLeaveRequests()).thenThrow(
          const ApiException(
            code: 'NETWORK_ERROR',
            statusCode: 503,
            message: 'Không thể kết nối máy chủ',
          ),
        );
        when(() => mockRequests.getMyOvertimeRequests()).thenThrow(
          const ApiException(
            code: 'NETWORK_ERROR',
            statusCode: 503,
            message: 'Không thể kết nối máy chủ',
          ),
        );
        when(() => mockPayslips.getMyPayslips()).thenThrow(
          const ApiException(
            code: 'NETWORK_ERROR',
            statusCode: 503,
            message: 'Không thể kết nối máy chủ',
          ),
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
        isA<OverviewError>().having((s) => s.message, 'message', contains('kết nối')),
      ],
    );

    blocTest<OverviewBloc, OverviewState>(
      'RefreshOverview triggers reload with isRefreshing',
      seed: () => const OverviewLoaded(
        todayAttendance: sampleToday,
        pendingRequestsCount: 4,
        newPayslipsCount: 2,
      ),
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
      act: (bloc) => bloc.add(const RefreshOverview()),
      expect: () => [
        isA<OverviewLoaded>().having((s) => s.isRefreshing, 'isRefreshing', true),
        isA<OverviewLoaded>().having((s) => s.isRefreshing, 'isRefreshing', false),
      ],
    );
  });
}
