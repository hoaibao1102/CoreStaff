import { Injectable } from '@nestjs/common';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

@Injectable()
export class HaversineService {
  private readonly EARTH_RADIUS_METERS = 6371000;

  /**
   * Tính khoảng cách đường thẳng địa lý (great-circle distance) giữa hai tọa độ GPS
   * theo công thức Haversine (đơn vị: mét).
   */
  calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
    const lat1Rad = this.toRadians(point1.latitude);
    const lat2Rad = this.toRadians(point2.latitude);
    const deltaLatRad = this.toRadians(point2.latitude - point1.latitude);
    const deltaLonRad = this.toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(this.EARTH_RADIUS_METERS * c * 10) / 10; // Làm tròn đến 1 chữ số thập phân
  }

  /**
   * Kiểm tra xem tọa độ của thiết bị có nằm trong bán kính Geofence cho phép của Workplace hay không.
   */
  isInsideGeofence(
    userLocation: GeoPoint,
    workplaceLocation: GeoPoint,
    allowedRadiusMeters: number,
  ): { isInside: boolean; distanceMeters: number } {
    const distanceMeters = this.calculateDistance(userLocation, workplaceLocation);
    return {
      isInside: distanceMeters <= allowedRadiusMeters,
      distanceMeters,
    };
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}
