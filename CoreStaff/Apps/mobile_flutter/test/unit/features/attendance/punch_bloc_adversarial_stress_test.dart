import 'dart:async';
import 'dart:io';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/models/attendance_assignment_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/punch_result_dto.dart';
import 'package:corestaff_mobile/features/attendance/data/models/today_attendance_dto.dart';
import 'package:corestaff_mobile/features/attendance/domain/services/punch_coordinator.dart';
import 'package:corestaff_mobile/features/attendance/presentation/bloc/punch_bloc.dart';

class MockPunchCoordinator extends Mock implements PunchCoordinator {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockPunchCoordinator mockCoordinator;

  const sampleTodayInOffice = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca hành chính',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Bitexco',
      address: '2 Hai Trieu, Ben Nghe, Q1, TP.HCM',
      workplaceType: 'IN_OFFICE',
    ),
  );

  const sampleTodayOutOffice = TodayAttendanceDto(
    workDate: '2026-11-04',
    serverTime: '2026-11-04T12:00:00.000Z',
    attendanceStatus: 'NOT_CHECKED_IN',
    availableAction: 'CHECK_IN',
    assignment: AttendanceAssignmentDto(
      shiftName: 'Ca thị trường',
      shiftHours: '08:00 - 17:00',
      startTime: '08:00',
      endTime: '17:00',
      workplaceName: 'Khách hàng ngoài',
      address: 'Quận 7, TP.HCM',
      workplaceType: 'OUT_OFFICE',
    ),
  );

  setUpAll(() {
    registerFallbackValue(sampleTodayInOffice);
  });

  setUp(() {
    mockCoordinator = MockPunchCoordinator();
  });

  group('PunchBloc Adversarial Hardware Disconnection & Platform Faults', () {
    blocTest<PunchBloc, PunchState>(
      'Hardware crash: PlatformException (channel disconnected) safely caught and emits PunchFailure',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          PlatformException(
            code: 'CHANNEL_DISCONNECTED',
            message: 'Hardware channel disconnected unexpectedly',
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('Hardware channel disconnected unexpectedly'),
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Hardware crash: PlatformException (location hardware disabled) safely emits PunchFailure',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          PlatformException(
            code: 'LOCATION_SERVICES_DISABLED',
            message: 'Location services are disabled on device',
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('Location services are disabled on device'),
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Hardware crash: MissingPluginException (unregistered native camera plugin) safely emits PunchFailure',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          MissingPluginException('No implementation found for method pickImage on channel image_picker'),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('MissingPluginException'),
        ),
      ],
    );
  });

  group('PunchBloc Adversarial Unhandled ApiExceptions & Error Resolutions', () {
    blocTest<PunchBloc, PunchState>(
      'Unhandled ApiException with LOCATION_PERMISSION_DENIED sets isPermissionDenied to true',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          const ApiException(
            code: 'LOCATION_PERMISSION_DENIED',
            message: 'Cần quyền truy cập vị trí để chấm công.',
            statusCode: 403,
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Cần quyền truy cập vị trí để chấm công.',
          errorCode: 'LOCATION_PERMISSION_DENIED',
          isPermissionDenied: true,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Unhandled ApiException with CAMERA_PERMISSION_DENIED sets isPermissionDenied to true',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          const ApiException(
            code: 'CAMERA_PERMISSION_DENIED',
            message: 'Cần quyền camera để chụp ảnh.',
            statusCode: 403,
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Cần quyền camera để chụp ảnh.',
          errorCode: 'CAMERA_PERMISSION_DENIED',
          isPermissionDenied: true,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Unhandled ApiException with ATTENDANCE_LOCKED resolves to friendly Vietnamese message',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          const ApiException(
            code: 'ATTENDANCE_LOCKED',
            message: 'Raw lock message',
            statusCode: 403,
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Kỳ công đã khóa, không thể thay đổi.',
          errorCode: 'ATTENDANCE_LOCKED',
          isPermissionDenied: false,
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Unhandled ApiException with completely null code and null message resolves to fallback message',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(
          const ApiException(
            code: null,
            message: '',
            statusCode: 500,
          ),
        );
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        const PunchFailure(
          message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
          errorCode: null,
          isPermissionDenied: false,
        ),
      ],
    );
  });

  group('PunchBloc Adversarial Dart Errors & Severe System Exceptions', () {
    blocTest<PunchBloc, PunchState>(
      'Dart Error: TypeError (e.g. malformed JSON cast error) caught without crashing BLoC',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenAnswer((_) async {
          // Intentionally throw a TypeError (not an Exception)
          throw TypeError();
        });
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('TypeError'),
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Dart Error: StateError caught cleanly without crashing BLoC',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(StateError('Invalid internal state in waterfall machine'));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('Invalid internal state'),
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'Network SocketException caught cleanly and emitted as PunchFailure',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(const SocketException('Failed host lookup: api.corestaff.internal'));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('Failed host lookup'),
        ),
      ],
    );

    blocTest<PunchBloc, PunchState>(
      'TimeoutException caught cleanly and emitted as PunchFailure',
      build: () {
        when(() => mockCoordinator.executeWaterfall(
              today: any(named: 'today'),
              onProgress: any(named: 'onProgress'),
            )).thenThrow(TimeoutException('Location fix timed out after 10000ms'));
        return PunchBloc(punchCoordinator: mockCoordinator);
      },
      act: (bloc) => bloc.add(const PunchSubmitted(today: sampleTodayInOffice)),
      expect: () => [
        const PunchDetectingEnvironment(
          message: 'Đang khởi động quá trình xác thực...',
          currentStep: PunchWaterfallStep.wifiCheck,
        ),
        isA<PunchFailure>().having(
          (s) => s.message,
          'message',
          contains('Location fix timed out'),
        ),
      ],
    );
  });

  group('PunchBloc Premature Disposal & Mid-Flight Cancellation Race Conditions', () {
    test('BLoC close during active waterfall does NOT throw StateError on subsequent progress emits', () async {
      final completer = Completer<PunchCoordinatorResult>();
      void Function(PunchWaterfallStep step, String text)? savedOnProgress;

      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((inv) {
        savedOnProgress = inv.namedArguments[const Symbol('onProgress')]
            as void Function(PunchWaterfallStep, String)?;
        return completer.future;
      });

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      bloc.add(const PunchSubmitted(today: sampleTodayInOffice));

      // Wait for initial event dispatch
      await Future<void>.delayed(const Duration(milliseconds: 20));
      expect(bloc.state, isA<PunchDetectingEnvironment>());

      // Close the BLoC while waterfall is still pending
      await bloc.close();
      expect(bloc.isClosed, isTrue);

      // Trigger progress after close - must be silently ignored via `if (!isClosed)` guard
      expect(
        () => savedOnProgress?.call(PunchWaterfallStep.gpsFix, 'Checking GPS...'),
        returnsNormally,
      );

      // Complete waterfall after close - must NOT throw StateError
      expect(
        () => completer.complete(const PunchCoordinatorSuccess(
          result: PunchResultDto(
            workDate: '2026-11-04',
            attendanceStatus: 'CHECKED_IN',
            availableAction: 'CHECK_OUT',
          ),
          method: 'NETWORK',
        )),
        returnsNormally,
      );

      await Future<void>.delayed(const Duration(milliseconds: 20));
    });

    test('BLoC close during active waterfall does NOT throw when coordinator fails after close', () async {
      final completer = Completer<PunchCoordinatorResult>();

      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((_) => completer.future);

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      bloc.add(const PunchSubmitted(today: sampleTodayInOffice));

      await Future<void>.delayed(const Duration(milliseconds: 20));
      await bloc.close();
      expect(bloc.isClosed, isTrue);

      // Complete with failure after close
      expect(
        () => completer.complete(const PunchCoordinatorFailure(
          message: 'Error after close',
          errorCode: 'ERROR_AFTER_CLOSE',
        )),
        returnsNormally,
      );

      await Future<void>.delayed(const Duration(milliseconds: 20));
    });

    test('BLoC close during active waterfall does NOT throw when coordinator throws after close', () async {
      final completer = Completer<PunchCoordinatorResult>();

      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((_) => completer.future);

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      bloc.add(const PunchSubmitted(today: sampleTodayInOffice));

      await Future<void>.delayed(const Duration(milliseconds: 20));
      await bloc.close();
      expect(bloc.isClosed, isTrue);

      // Complete with exception after close
      expect(
        () => completer.completeError(Exception('Fatal crash after close')),
        returnsNormally,
      );

      await Future<void>.delayed(const Duration(milliseconds: 20));
    });
  });

  group('PunchBloc Terminal Liveness & UI Freeze Prevention Oracle', () {
    test('Waterfall progress callbacks emit corresponding intermediate states in order', () async {
      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((inv) async {
        final onProgress = inv.namedArguments[const Symbol('onProgress')]
            as void Function(PunchWaterfallStep, String);
        onProgress(PunchWaterfallStep.wifiCheck, 'Scanning Wi-Fi...');
        onProgress(PunchWaterfallStep.gpsFix, 'Fixing GPS satellites...');
        onProgress(PunchWaterfallStep.promptSelfie, 'Selfie required for outside office');
        onProgress(PunchWaterfallStep.submitting, 'Uploading multipart punch...');
        return const PunchCoordinatorSuccess(
          result: PunchResultDto(
            workDate: '2026-11-04',
            attendanceStatus: 'CHECKED_IN',
            availableAction: 'CHECK_OUT',
          ),
          method: 'SELFIE',
        );
      });

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      final emitted = <PunchState>[];
      final sub = bloc.stream.listen(emitted.add);

      bloc.add(const PunchSubmitted(today: sampleTodayInOffice));
      await Future<void>.delayed(const Duration(milliseconds: 100));

      // Emitted sequence:
      // 0: DetectingEnvironment (initial startup)
      // 1: DetectingEnvironment (wifiCheck)
      // 2: DetectingEnvironment (gpsFix)
      // 3: PromptSelfie
      // 4: Submitting
      // 5: MethodDecided
      // 6: Success
      expect(emitted.length, 7);
      expect(emitted[0], isA<PunchDetectingEnvironment>());
      expect(emitted[1], isA<PunchDetectingEnvironment>());
      expect(emitted[2], isA<PunchDetectingEnvironment>());
      expect(emitted[3], isA<PunchPromptSelfie>());
      expect(emitted[4], isA<PunchSubmitting>());
      expect(emitted[5], isA<PunchMethodDecided>());
      expect(emitted[6], isA<PunchSuccess>());

      // TERMINAL GUARANTEE: The final state is NEVER progress, it is PunchSuccess
      expect(bloc.state, isA<PunchSuccess>());

      await sub.cancel();
      await bloc.close();
    });

    test('UI Never Trapped in PromptSelfie: Coordinator failure after promptSelfie settles to PunchFailure', () async {
      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((inv) async {
        final onProgress = inv.namedArguments[const Symbol('onProgress')]
            as void Function(PunchWaterfallStep, String);
        onProgress(PunchWaterfallStep.promptSelfie, 'Need selfie');
        return const PunchCoordinatorFailure(
          message: 'Camera sensor malfunction',
          errorCode: 'CAMERA_ERROR',
        );
      });

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      final emitted = <PunchState>[];
      final sub = bloc.stream.listen(emitted.add);

      bloc.add(const PunchSubmitted(today: sampleTodayOutOffice));
      await Future<void>.delayed(const Duration(milliseconds: 100));

      // Terminal state MUST be PunchFailure
      expect(bloc.state, isA<PunchFailure>());
      expect((bloc.state as PunchFailure).errorCode, 'CAMERA_ERROR');

      await sub.cancel();
      await bloc.close();
    });

    test('UI Never Trapped in DetectingEnvironment: Network crash during gpsFix settles to PunchFailure', () async {
      when(() => mockCoordinator.executeWaterfall(
            today: any(named: 'today'),
            onProgress: any(named: 'onProgress'),
          )).thenAnswer((inv) async {
        final onProgress = inv.namedArguments[const Symbol('onProgress')]
            as void Function(PunchWaterfallStep, String);
        onProgress(PunchWaterfallStep.gpsFix, 'Fixing GPS satellites...');
        throw Exception('Location service crashed mid-operation');
      });

      final bloc = PunchBloc(punchCoordinator: mockCoordinator);
      final emitted = <PunchState>[];
      final sub = bloc.stream.listen(emitted.add);

      bloc.add(const PunchSubmitted(today: sampleTodayInOffice));
      await Future<void>.delayed(const Duration(milliseconds: 100));

      // Terminal state MUST be PunchFailure
      expect(bloc.state, isA<PunchFailure>());
      expect((bloc.state as PunchFailure).message, 'Location service crashed mid-operation');

      await sub.cancel();
      await bloc.close();
    });
  });
}
