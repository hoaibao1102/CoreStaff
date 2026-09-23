import { HaversineService } from './haversine.service';

describe('HaversineService', () => {
  let service: HaversineService;

  beforeEach(() => {
    service = new HaversineService();
  });

  it('should return 0 meters for identical points', () => {
    const point = { latitude: 10.7769, longitude: 106.7009 };
    const distance = service.calculateDistance(point, point);
    expect(distance).toBe(0);
  });

  it('should accurately calculate distance between Ben Thanh and Bitexco (~800m)', () => {
    const benThanh = { latitude: 10.7725, longitude: 106.6980 };
    const bitexco = { latitude: 10.7716, longitude: 106.7044 };
    const distance = service.calculateDistance(benThanh, bitexco);

    // Khoảng cách thực tế ~710m - 750m
    expect(distance).toBeGreaterThan(700);
    expect(distance).toBeLessThan(750);
  });

  it('should correctly determine inside and outside geofence boundary', () => {
    const workplace = { latitude: 10.7769, longitude: 106.7009 };
    // Điểm cách khoảng 50m
    const nearUser = { latitude: 10.7772, longitude: 106.7012 };
    const resultNear = service.isInsideGeofence(nearUser, workplace, 100);
    expect(resultNear.isInside).toBe(true);
    expect(resultNear.distanceMeters).toBeLessThan(100);

    // Điểm cách khoảng 150m
    const farUser = { latitude: 10.7785, longitude: 106.7020 };
    const resultFar = service.isInsideGeofence(farUser, workplace, 100);
    expect(resultFar.isInside).toBe(false);
    expect(resultFar.distanceMeters).toBeGreaterThan(100);
  });
});
