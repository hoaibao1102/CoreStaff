import { Platform } from 'react-native';

/**
 * Base URL của NestJS API.
 * - Android emulator dùng 10.0.2.2 thay cho localhost.
 * - iOS simulator có thể dùng localhost.
 * - Thiết bị thật: đổi thành địa chỉ LAN của máy chạy API (vd http://192.168.x.x:3000).
 */
export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';