import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';
import '../../features/account/data/account_repository.dart';
import '../../features/account/presentation/bloc/account_bloc.dart';
import '../../features/attendance/data/attendance_repository.dart';
import '../../features/attendance/data/services/camera_service.dart';
import '../../features/attendance/data/services/location_service.dart';
import '../../features/attendance/data/services/wifi_service.dart';
import '../../features/attendance/domain/services/punch_coordinator.dart';
import '../../features/attendance/presentation/bloc/attendance_bloc.dart';
import '../../features/attendance/presentation/bloc/punch_bloc.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/overview/presentation/bloc/overview_bloc.dart';
import '../../features/payslip/data/payslip_repository.dart';
import '../../features/payslip/presentation/bloc/payslip_bloc.dart';
import '../../features/requests/data/requests_repository.dart';
import '../../features/requests/presentation/bloc/request_form_cubit.dart';
import '../../features/requests/presentation/bloc/requests_bloc.dart';
import '../../services/auth_service.dart';
import '../network/api_client.dart';
import '../network/cookie_manager.dart';
import '../services/lifecycle_listener.dart';
import '../services/realtime_sync_coordinator.dart';
import '../services/socket_service.dart';
import '../storage/secure_storage_service.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // 1. Storage
  if (!sl.isRegistered<SecureStorageService>()) {
    sl.registerLazySingleton<SecureStorageService>(() => SecureStorageServiceImpl());
  }

  // 2. Cookie Manager
  if (!sl.isRegistered<AppCookieManager>()) {
    sl.registerLazySingleton<AppCookieManager>(
      () => AppCookieManager(sl<SecureStorageService>()),
    );
  }

  // 3. Network Engine
  if (!sl.isRegistered<Dio>()) {
    sl.registerLazySingleton<Dio>(() => Dio());
  }

  if (!sl.isRegistered<ApiClient>()) {
    sl.registerLazySingleton<ApiClient>(
      () => ApiClient(
        dio: sl<Dio>(),
        cookieManager: sl<AppCookieManager>(),
      ),
    );
  }

  // 4. Repositories
  if (!sl.isRegistered<AuthRepository>()) {
    sl.registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(apiClient: sl<ApiClient>()),
    );
  }

  if (!sl.isRegistered<AccountRepository>()) {
    sl.registerLazySingleton<AccountRepository>(
      () => AccountRepositoryImpl(apiClient: sl<ApiClient>()),
    );
  }

  if (!sl.isRegistered<PayslipRepository>()) {
    sl.registerLazySingleton<PayslipRepository>(
      () => PayslipRepositoryImpl(apiClient: sl<ApiClient>()),
    );
  }

  if (!sl.isRegistered<RequestsRepository>()) {
    sl.registerLazySingleton<RequestsRepository>(
      () => RequestsRepositoryImpl(apiClient: sl<ApiClient>()),
    );
  }

  if (!sl.isRegistered<AttendanceRepository>()) {
    sl.registerLazySingleton<AttendanceRepository>(
      () => AttendanceRepositoryImpl(apiClient: sl<ApiClient>()),
    );
  }

  // Backward compatibility bridge for AuthService singleton
  AuthService.instance.initialize(sl<AuthRepository>());

  // 5. BLoCs
  if (!sl.isRegistered<AuthBloc>()) {
    sl.registerFactory<AuthBloc>(
      () => AuthBloc(
        authRepository: sl<AuthRepository>(),
        apiClient: sl<ApiClient>(),
      ),
    );
  }

  if (!sl.isRegistered<AccountBloc>()) {
    sl.registerFactory<AccountBloc>(
      () => AccountBloc(
        accountRepository: sl<AccountRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<PayslipBloc>()) {
    sl.registerFactory<PayslipBloc>(
      () => PayslipBloc(
        payslipRepository: sl<PayslipRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<RequestsBloc>()) {
    sl.registerFactory<RequestsBloc>(
      () => RequestsBloc(
        requestsRepository: sl<RequestsRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<RequestFormCubit>()) {
    sl.registerFactory<RequestFormCubit>(
      () => RequestFormCubit(
        repository: sl<RequestsRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<AttendanceBloc>()) {
    sl.registerFactory<AttendanceBloc>(
      () => AttendanceBloc(
        attendanceRepository: sl<AttendanceRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<OverviewBloc>()) {
    sl.registerFactory<OverviewBloc>(
      () => OverviewBloc(
        attendanceRepository: sl<AttendanceRepository>(),
        requestsRepository: sl<RequestsRepository>(),
        payslipRepository: sl<PayslipRepository>(),
      ),
    );
  }

  // 6. Hardware Services (MIG-16, MIG-17, MIG-18)
  if (!sl.isRegistered<WifiService>()) {
    sl.registerLazySingleton<WifiService>(() => WifiServiceImpl());
  }
  if (!sl.isRegistered<LocationService>()) {
    sl.registerLazySingleton<LocationService>(() => LocationServiceImpl());
  }
  if (!sl.isRegistered<CameraService>()) {
    sl.registerLazySingleton<CameraService>(() => CameraServiceImpl());
  }

  // 7. Punch Coordinator & BLoC (MIG-19)
  if (!sl.isRegistered<PunchCoordinator>()) {
    sl.registerLazySingleton<PunchCoordinator>(
      () => PunchCoordinatorImpl(
        wifiService: sl<WifiService>(),
        locationService: sl<LocationService>(),
        cameraService: sl<CameraService>(),
        attendanceRepository: sl<AttendanceRepository>(),
      ),
    );
  }

  if (!sl.isRegistered<PunchBloc>()) {
    sl.registerFactory<PunchBloc>(
      () => PunchBloc(
        punchCoordinator: sl<PunchCoordinator>(),
      ),
    );
  }

  // 8. Realtime & Lifecycle Services (MIG-20, MIG-21)
  if (!sl.isRegistered<SocketService>()) {
    sl.registerLazySingleton<SocketService>(
      () => SocketServiceImpl(
        cookieManager: sl<AppCookieManager>(),
      ),
    );
  }

  if (!sl.isRegistered<RealtimeSyncCoordinator>()) {
    sl.registerLazySingleton<RealtimeSyncCoordinator>(
      () => RealtimeSyncCoordinator(
        socketService: sl<SocketService>(),
      ),
    );
  }

  if (!sl.isRegistered<AppLifecycleCoordinator>()) {
    sl.registerLazySingleton<AppLifecycleCoordinator>(
      () => AppLifecycleCoordinator(
        socketService: sl<SocketService>(),
      ),
    );
  }
}

