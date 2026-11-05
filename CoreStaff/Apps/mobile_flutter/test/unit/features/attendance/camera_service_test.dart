import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mocktail/mocktail.dart';
import 'package:corestaff_mobile/core/network/api_exception.dart';
import 'package:corestaff_mobile/features/attendance/data/services/camera_service.dart';

class MockImagePicker extends Mock implements ImagePicker {}

void main() {
  late MockImagePicker mockPicker;
  late CameraService cameraService;

  setUp(() {
    mockPicker = MockImagePicker();
    cameraService = CameraServiceImpl(picker: mockPicker);
  });

  group('CameraService Unit Tests', () {
    test('captureSelfie returns local file path on successful photo capture', () async {
      final mockFile = XFile('/data/user/0/app/cache/selfie_123.jpg');
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenAnswer((_) async => mockFile);

      final path = await cameraService.captureSelfie();

      expect(path, '/data/user/0/app/cache/selfie_123.jpg');
      verify(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).called(1);
    });

    test('captureSelfie returns null when user cancels camera shot', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenAnswer((_) async => null);

      final path = await cameraService.captureSelfie();

      expect(path, isNull);
    });

    test('captureSelfie throws ApiException when camera permission is denied by OS', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenThrow(PlatformException(code: 'camera_access_denied'));

      expect(
        () => cameraService.captureSelfie(),
        throwsA(isA<ApiException>().having(
          (e) => e.code,
          'code',
          'CAMERA_PERMISSION_DENIED',
        )),
      );
    });

    test('captureSelfie returns null gracefully on unexpected exception', () async {
      when(() => mockPicker.pickImage(
            source: ImageSource.camera,
            preferredCameraDevice: CameraDevice.front,
            imageQuality: 60,
          )).thenThrow(Exception('Native bridge failure'));

      final path = await cameraService.captureSelfie();

      expect(path, isNull);
    });
  });
}
