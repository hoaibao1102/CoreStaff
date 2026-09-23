import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AttendanceDay, AttendanceDayDocument } from '../database/schemas/attendance-day.schema';
import { AttendanceEvent, AttendanceEventDocument } from '../database/schemas/attendance-event.schema';
import { Evidence, EvidenceDocument } from '../database/schemas/evidence.schema';
import {
  AttendanceApprovalStatus,
  AttendanceEventType,
  AttendanceMethod,
  AttendanceStatus,
  WorkMode,
} from '../database/schemas/enums';
import { HaversineService } from './services/haversine.service';
import { NetworkValidatorService } from './services/network-validator.service';
import { AttendanceCalculatorService } from './services/attendance-calculator.service';
import { StorageService } from '../storage/storage.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel('AttendanceDay') private attendanceDayModel: Model<AttendanceDayDocument>,
    @InjectModel('AttendanceEvent') private attendanceEventModel: Model<AttendanceEventDocument>,
    @InjectModel('Evidence') private evidenceModel: Model<EvidenceDocument>,
    @InjectModel('Assignment') private assignmentModel: Model<any>,
    @InjectModel('Workplace') private workplaceModel: Model<any>,
    @InjectModel('ShiftTemplate') private shiftTemplateModel: Model<any>,
    @InjectModel('ManagerAssignment') private managerAssignmentModel: Model<any>,
    @InjectModel('ManagerRequest') private managerRequestModel: Model<any>,
    @InjectModel('EmployeeProfile') private employeeProfileModel: Model<any>,
    private haversineService: HaversineService,
    private networkValidatorService: NetworkValidatorService,
    private calculatorService: AttendanceCalculatorService,
    private storageService: StorageService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  /**
   * Lấy ngày làm việc hôm nay theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) dạng YYYY-MM-DD
   */
  getTodayWorkDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }

  /**
   * Lấy trạng thái chấm công hôm nay của nhân viên
   */
  async getTodayState(employeeId: string, organizationId: string) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const empObjectId = new Types.ObjectId(employeeId);
    const workDate = this.getTodayWorkDate();

    // 1. Tìm Assignment hiệu lực
    const assignment: any = await this.assignmentModel
      .findOne({
        organizationId: orgObjectId,
        $or: [{ userId: empObjectId }, { employeeId: empObjectId }],
        active: true,
      })
      .populate('workplaceId')
      .populate('shiftTemplateId')
      .populate('departmentId')
      .lean();

    const workplace = assignment?.workplaceId;
    const shift = assignment?.shiftTemplateId || assignment?.shiftId;

    // 2. Tìm AttendanceDay hôm nay
    const day = await this.attendanceDayModel
      .findOne({
        organizationId: orgObjectId,
        employeeId: empObjectId,
        workDate,
      })
      .lean();

    let checkInEvent: any = null;
    let checkOutEvent: any = null;

    if (day) {
      const events = await this.attendanceEventModel
        .find({
          organizationId: orgObjectId,
          attendanceDayId: day._id,
        })
        .populate('evidenceId')
        .lean();

      checkInEvent = events.find((e) => e.eventType === AttendanceEventType.CHECK_IN);
      checkOutEvent = events.find((e) => e.eventType === AttendanceEventType.CHECK_OUT);
    }

    let attendanceStatus = day?.attendanceStatus || AttendanceStatus.NOT_CHECKED_IN;
    let availableAction = 'NONE';

    if (attendanceStatus === AttendanceStatus.NOT_CHECKED_IN) {
      availableAction = 'CHECK_IN';
    } else if (attendanceStatus === AttendanceStatus.CHECKED_IN) {
      availableAction = 'CHECK_OUT';
    }

    // Tìm yêu cầu phê duyệt gần nhất trong ngày (nếu có)
    const latestRequest: any = await this.managerRequestModel
      .findOne({
        organizationId: orgObjectId,
        employeeUserId: empObjectId,
        workDate,
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      workDate,
      serverTime: new Date().toISOString(),
      attendanceStatus,
      availableAction,
      workMode: day?.workMode || null,
      checkIn: checkInEvent
        ? {
            eventId: checkInEvent._id,
            eventType: checkInEvent.eventType,
            method: checkInEvent.method,
            recordedAt: checkInEvent.recordedAt,
            address: checkInEvent.address,
            distanceMeters: checkInEvent.distanceFromWorkplaceMeters,
            approvalStatus: checkInEvent.approvalStatus,
            evidenceUrl: checkInEvent.evidenceId ? `/api/attendance/evidence/${checkInEvent.evidenceId._id}` : null,
          }
        : null,
      checkOut: checkOutEvent
        ? {
            eventId: checkOutEvent._id,
            eventType: checkOutEvent.eventType,
            method: checkOutEvent.method,
            recordedAt: checkOutEvent.recordedAt,
            address: checkOutEvent.address,
            distanceMeters: checkOutEvent.distanceFromWorkplaceMeters,
            approvalStatus: checkOutEvent.approvalStatus,
            evidenceUrl: checkOutEvent.evidenceId ? `/api/attendance/evidence/${checkOutEvent.evidenceId._id}` : null,
          }
        : null,
      workingMinutes: day?.workingMinutes ?? null,
      lateMinutes: day?.lateMinutes || 0,
      earlyMinutes: day?.earlyMinutes || 0,
      overallApprovalStatus: day?.overallApprovalStatus || (latestRequest ? latestRequest.status : AttendanceApprovalStatus.NOT_REQUIRED),
      approvalComment: latestRequest?.reviewComment || null,
      approvalReviewedAt: latestRequest?.reviewedAt || null,
      assignment: {
        shiftName: shift?.name || 'Ca hành chính',
        shiftHours: shift ? `${shift.startTime} - ${shift.endTime}` : '08:00 - 17:00',
        startTime: shift?.startTime || '08:00',
        endTime: shift?.endTime || '17:00',
        breakMinutes: shift?.breakMinutes ?? 60,
        gracePeriodMinutes: shift?.gracePeriodMinutes ?? 15,
        workplaceId: workplace?._id || null,
        workplaceName: workplace?.name || 'Văn phòng chính',
        workplaceType: workplace?.type || 'IN_OFFICE',
        address: workplace?.address || '',
        latitude: workplace?.latitude || 10.7769,
        longitude: workplace?.longitude || 106.7009,
        allowedRadiusMeters: workplace?.allowedRadiusMeters || 100,
        maximumAccuracyMeters: workplace?.maximumAccuracyMeters || 80,
        allowNetworkAttendance: workplace?.allowNetworkAttendance ?? true,
        allowGpsAttendance: workplace?.allowGpsAttendance ?? true,
        allowSelfieFallback: workplace?.allowSelfieFallback ?? true,
      },
    };
  }

  /**
   * Xử lý Check-in
   */
  async checkIn(
    employeeId: string,
    organizationId: string,
    dto: CheckInDto,
    file?: Express.Multer.File,
    clientIp?: string,
    userAgent?: string,
  ) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const empObjectId = new Types.ObjectId(employeeId);
    const workDate = this.getTodayWorkDate();

    // 1. Kiểm tra đã check-in chưa
    const existingDay = await this.attendanceDayModel.findOne({
      organizationId: orgObjectId,
      employeeId: empObjectId,
      workDate,
    });

    if (existingDay && existingDay.attendanceStatus !== AttendanceStatus.NOT_CHECKED_IN) {
      throw new ConflictException('ALREADY_CHECKED_IN');
    }

    // 2. Lấy Assignment và Workplace, Shift
    const assignment: any = await this.assignmentModel
      .findOne({
        organizationId: orgObjectId,
        $or: [{ userId: empObjectId }, { employeeId: empObjectId }],
        active: true,
      })
      .populate('workplaceId')
      .populate('shiftTemplateId')
      .populate('departmentId');

    if (!assignment) {
      throw new ConflictException('ASSIGNMENT_NOT_CONFIGURED');
    }

    const workplace = assignment.workplaceId;
    const shift = assignment.shiftTemplateId || assignment.shiftId;
    const recordedAt = new Date();

    let method: AttendanceMethod;
    let approvalStatus: AttendanceApprovalStatus = AttendanceApprovalStatus.NOT_REQUIRED;
    let evidenceId: Types.ObjectId | undefined;
    let isFallback = false;
    let distanceFromWorkplaceMeters: number | undefined;

    const lat = dto.location?.latitude ?? dto.latitude;
    const lng = dto.location?.longitude ?? dto.longitude;
    const accuracy = dto.location?.accuracyMeters ?? dto.accuracyMeters;
    const clientCapturedAt = dto.location?.capturedAtClient ? new Date(dto.location.capturedAtClient) : undefined;
    const rawAddress = dto.location?.address ?? dto.address;
    const address = await this.resolveLocationAddress(lat, lng, rawAddress, workplace?.address);

    // 3. Phân định luồng xác thực
    if (file || dto.workMode === WorkMode.OUT_OFFICE) {
      // Luồng Selfie (OUT_OFFICE hoặc Fallback)
      if (!file) {
        throw new BadRequestException('SELFIE_IMAGE_INVALID');
      }

      this.validateImageFile(file);

      method = AttendanceMethod.SELFIE;
      approvalStatus = AttendanceApprovalStatus.PENDING;

      if (dto.workMode === WorkMode.IN_OFFICE) {
        isFallback = true;
      }

      // Lưu file vào StorageService
      const newEvidenceId = new Types.ObjectId();
      const storageKey = `${organizationId}/evidence/${newEvidenceId}.jpg`;

      if (this.storageService.isConfigured()) {
        try {
          await this.storageService.upload(storageKey, file.buffer, file.mimetype);
        } catch (uploadErr) {
          console.warn('[AttendanceService] Storage upload failed:', uploadErr);
        }
      }

      const evidenceDoc = await this.evidenceModel.create({
        _id: newEvidenceId,
        organizationId: orgObjectId,
        ownerUserId: empObjectId,
        storageKey,
        originalFileName: file.originalname || 'selfie.jpg',
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });

      evidenceId = evidenceDoc._id as Types.ObjectId;

      // Tính khoảng cách nếu có tọa độ
      if (lat != null && lng != null && workplace?.latitude && workplace?.longitude) {
        distanceFromWorkplaceMeters = this.haversineService.calculateDistance(
          { latitude: lat, longitude: lng },
          { latitude: workplace.latitude, longitude: workplace.longitude },
        );
      }
    } else {
      // Luồng IN_OFFICE bình thường: Ưu tiên Network -> GPS
      let networkMatched = false;

      if (clientIp && workplace?.allowedNetworks?.length) {
        networkMatched = this.networkValidatorService.isIpAllowed(clientIp, workplace.allowedNetworks);
      }

      if (networkMatched && workplace?.allowNetworkAttendance !== false) {
        method = AttendanceMethod.NETWORK;
      } else {
        // Thử GPS
        if (lat != null && lng != null && workplace?.latitude && workplace?.longitude) {
          const maxAcc = workplace.maximumAccuracyMeters || 80;
          if (accuracy && accuracy > maxAcc) {
            throw new UnprocessableEntityException('LOW_LOCATION_ACCURACY');
          }

          const geofence = this.haversineService.isInsideGeofence(
            { latitude: lat, longitude: lng },
            { latitude: workplace.latitude, longitude: workplace.longitude },
            workplace.allowedRadiusMeters || 100,
          );

          distanceFromWorkplaceMeters = geofence.distanceMeters;

          if (geofence.isInside && workplace?.allowGpsAttendance !== false) {
            method = AttendanceMethod.GPS;
          } else {
            if (workplace?.allowSelfieFallback !== false) {
              throw new UnprocessableEntityException('SELFIE_REQUIRED');
            }
            throw new UnprocessableEntityException('OUTSIDE_ALLOWED_AREA');
          }
        } else {
          if (workplace?.allowSelfieFallback !== false) {
            throw new UnprocessableEntityException('SELFIE_REQUIRED');
          }
          throw new UnprocessableEntityException('NETWORK_NOT_ALLOWED');
        }
      }
    }

    // 4. Tính toán lateMinutes
    const shiftSnapshot = {
      shiftTemplateId: shift?._id?.toString(),
      shiftName: shift?.name || 'Ca hành chính',
      startTime: shift?.startTime || '08:00',
      endTime: shift?.endTime || '17:00',
      breakMinutes: shift?.breakMinutes ?? 60,
      gracePeriodMinutes: shift?.gracePeriodMinutes ?? 15,
    };

    const workplaceSnapshot = {
      workplaceId: workplace?._id?.toString(),
      workplaceName: workplace?.name || 'Văn phòng chính',
      workplaceType: workplace?.type || dto.workMode,
      address: workplace?.address,
      latitude: workplace?.latitude,
      longitude: workplace?.longitude,
      allowedRadiusMeters: workplace?.allowedRadiusMeters,
    };

    const calcResult = this.calculatorService.calculate(workDate, recordedAt, undefined, shiftSnapshot);

    // 5. Lưu AttendanceDay
    let day = existingDay;
    if (!day) {
      day = await this.attendanceDayModel.create({
        organizationId: orgObjectId,
        employeeId: empObjectId,
        workDate,
        workMode: dto.workMode,
        attendanceStatus: AttendanceStatus.CHECKED_IN,
        overallApprovalStatus: approvalStatus,
        checkInAt: recordedAt,
        lateMinutes: calcResult.lateMinutes,
        shiftSnapshot,
        workplaceSnapshot,
      });
    } else {
      day.workMode = dto.workMode;
      day.attendanceStatus = AttendanceStatus.CHECKED_IN;
      day.overallApprovalStatus = approvalStatus;
      day.checkInAt = recordedAt;
      day.lateMinutes = calcResult.lateMinutes;
      day.shiftSnapshot = shiftSnapshot;
      day.workplaceSnapshot = workplaceSnapshot;
      await day.save();
    }

    // 6. Lưu AttendanceEvent
    const event = await this.attendanceEventModel.create({
      organizationId: orgObjectId,
      attendanceDayId: day._id,
      employeeId: empObjectId,
      eventType: AttendanceEventType.CHECK_IN,
      method,
      recordedAt,
      capturedAtClient: clientCapturedAt,
      publicIp: clientIp,
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      distanceFromWorkplaceMeters,
      address,
      approvalStatus,
      evidenceId,
      userAgent,
      isFallback,
      note: dto.note,
    });

    // 7. Nếu Selfie, tạo ManagerRequest (ApprovalRequest)
    if (method === AttendanceMethod.SELFIE) {
      await this.createApprovalRequestForManager(
        orgObjectId,
        empObjectId,
        assignment.departmentId?._id || assignment.departmentId,
        day._id as Types.ObjectId,
        workDate,
        'CHECK_IN',
        dto.note || (isFallback ? 'Chấm công Selfie bổ sung tại văn phòng' : 'Chấm công Selfie ngoài văn phòng (Thực địa)'),
        evidenceId,
        {
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          address,
          isFallback,
        },
      );
    }

    return {
      workDate,
      attendanceStatus: AttendanceStatus.CHECKED_IN,
      availableAction: 'CHECK_OUT',
      workMode: dto.workMode,
      overallApprovalStatus: approvalStatus,
      checkIn: {
        eventId: event._id,
        eventType: event.eventType,
        method: event.method,
        recordedAt: event.recordedAt,
        distanceMeters: distanceFromWorkplaceMeters,
        approvalStatus: event.approvalStatus,
      },
    };
  }

  /**
   * Xử lý Check-out
   */
  async checkOut(
    employeeId: string,
    organizationId: string,
    dto: CheckOutDto,
    file?: Express.Multer.File,
    clientIp?: string,
    userAgent?: string,
  ) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const empObjectId = new Types.ObjectId(employeeId);
    const workDate = this.getTodayWorkDate();

    // 1. Tìm ngày công hiện tại
    const day = await this.attendanceDayModel.findOne({
      organizationId: orgObjectId,
      employeeId: empObjectId,
      workDate,
    });

    if (!day || day.attendanceStatus !== AttendanceStatus.CHECKED_IN) {
      throw new ConflictException('INVALID_ATTENDANCE_ACTION');
    }

    // Kiểm tra đã check-out chưa
    const existingOutEvent = await this.attendanceEventModel.findOne({
      organizationId: orgObjectId,
      attendanceDayId: day._id,
      eventType: AttendanceEventType.CHECK_OUT,
    });

    if (existingOutEvent) {
      throw new ConflictException('ALREADY_CHECKED_OUT');
    }

    // 2. Lấy Assignment và Workplace
    const assignment: any = await this.assignmentModel
      .findOne({
        organizationId: orgObjectId,
        $or: [{ userId: empObjectId }, { employeeId: empObjectId }],
        active: true,
      })
      .populate('workplaceId')
      .populate('shiftTemplateId')
      .populate('departmentId');

    const workplace = assignment?.workplaceId;
    const shift = day.shiftSnapshot || assignment?.shiftTemplateId || assignment?.shiftId;
    const recordedAt = new Date();

    let method: AttendanceMethod;
    let approvalStatus: AttendanceApprovalStatus = AttendanceApprovalStatus.NOT_REQUIRED;
    let evidenceId: Types.ObjectId | undefined;
    let isFallback = false;
    let distanceFromWorkplaceMeters: number | undefined;

    const lat = dto.location?.latitude ?? dto.latitude;
    const lng = dto.location?.longitude ?? dto.longitude;
    const accuracy = dto.location?.accuracyMeters ?? dto.accuracyMeters;
    const clientCapturedAt = dto.location?.capturedAtClient ? new Date(dto.location.capturedAtClient) : undefined;
    const rawAddress = dto.location?.address ?? dto.address;
    const address = await this.resolveLocationAddress(lat, lng, rawAddress, workplace?.address);

    // Check-out sử dụng workMode đã lưu từ Check-in
    if (file || day.workMode === WorkMode.OUT_OFFICE) {
      if (!file) {
        throw new BadRequestException('SELFIE_IMAGE_INVALID');
      }

      this.validateImageFile(file);

      method = AttendanceMethod.SELFIE;
      approvalStatus = AttendanceApprovalStatus.PENDING;

      if (day.workMode === WorkMode.IN_OFFICE) {
        isFallback = true;
      }

      const newEvidenceId = new Types.ObjectId();
      const storageKey = `${organizationId}/evidence/${newEvidenceId}.jpg`;

      if (this.storageService.isConfigured()) {
        try {
          await this.storageService.upload(storageKey, file.buffer, file.mimetype);
        } catch (uploadErr) {
          console.warn('[AttendanceService] Storage upload failed:', uploadErr);
        }
      }

      const evidenceDoc = await this.evidenceModel.create({
        _id: newEvidenceId,
        organizationId: orgObjectId,
        ownerUserId: empObjectId,
        storageKey,
        originalFileName: file.originalname || 'checkout-selfie.jpg',
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });

      evidenceId = evidenceDoc._id as Types.ObjectId;

      if (lat != null && lng != null && workplace?.latitude && workplace?.longitude) {
        distanceFromWorkplaceMeters = this.haversineService.calculateDistance(
          { latitude: lat, longitude: lng },
          { latitude: workplace.latitude, longitude: workplace.longitude },
        );
      }
    } else {
      let networkMatched = false;
      if (clientIp && workplace?.allowedNetworks?.length) {
        networkMatched = this.networkValidatorService.isIpAllowed(clientIp, workplace.allowedNetworks);
      }

      if (networkMatched && workplace?.allowNetworkAttendance !== false) {
        method = AttendanceMethod.NETWORK;
      } else {
        if (lat != null && lng != null && workplace?.latitude && workplace?.longitude) {
          const maxAcc = workplace.maximumAccuracyMeters || 80;
          if (accuracy && accuracy > maxAcc) {
            throw new UnprocessableEntityException('LOW_LOCATION_ACCURACY');
          }

          const geofence = this.haversineService.isInsideGeofence(
            { latitude: lat, longitude: lng },
            { latitude: workplace.latitude, longitude: workplace.longitude },
            workplace.allowedRadiusMeters || 100,
          );

          distanceFromWorkplaceMeters = geofence.distanceMeters;

          if (geofence.isInside && workplace?.allowGpsAttendance !== false) {
            method = AttendanceMethod.GPS;
          } else {
            if (workplace?.allowSelfieFallback !== false) {
              throw new UnprocessableEntityException('SELFIE_REQUIRED');
            }
            throw new UnprocessableEntityException('OUTSIDE_ALLOWED_AREA');
          }
        } else {
          if (workplace?.allowSelfieFallback !== false) {
            throw new UnprocessableEntityException('SELFIE_REQUIRED');
          }
          throw new UnprocessableEntityException('NETWORK_NOT_ALLOWED');
        }
      }
    }

    // 3. Tính toán earlyMinutes và workingMinutes
    const checkInAt = day.checkInAt || recordedAt;
    const calcResult = this.calculatorService.calculate(workDate, checkInAt, recordedAt, shift);

    // 4. Cập nhật AttendanceDay
    day.checkOutAt = recordedAt;
    day.workingMinutes = calcResult.workingMinutes ?? 0;
    day.earlyMinutes = calcResult.earlyMinutes;
    day.attendanceStatus = AttendanceStatus.COMPLETED;

    if (approvalStatus === AttendanceApprovalStatus.PENDING) {
      day.overallApprovalStatus = AttendanceApprovalStatus.PENDING;
    }

    await day.save();

    // 5. Tạo AttendanceEvent cho CHECK_OUT
    const outEvent = await this.attendanceEventModel.create({
      organizationId: orgObjectId,
      attendanceDayId: day._id,
      employeeId: empObjectId,
      eventType: AttendanceEventType.CHECK_OUT,
      method,
      recordedAt,
      capturedAtClient: clientCapturedAt,
      publicIp: clientIp,
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
      distanceFromWorkplaceMeters,
      address,
      approvalStatus,
      evidenceId,
      userAgent,
      isFallback,
      note: dto.note,
    });

    if (method === AttendanceMethod.SELFIE) {
      await this.createApprovalRequestForManager(
        orgObjectId,
        empObjectId,
        assignment?.departmentId?._id || assignment?.departmentId,
        day._id as Types.ObjectId,
        workDate,
        'CHECK_OUT',
        dto.note || (isFallback ? 'Chấm công Selfie bổ sung khi ra ca tại văn phòng' : 'Chấm công Selfie ngoài văn phòng khi ra ca (Thực địa)'),
        evidenceId,
        {
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          address,
          isFallback,
        },
      );
    }

    return {
      workDate,
      attendanceStatus: AttendanceStatus.COMPLETED,
      availableAction: 'NONE',
      workingMinutes: day.workingMinutes,
      lateMinutes: day.lateMinutes,
      earlyMinutes: day.earlyMinutes,
      checkOut: {
        eventId: outEvent._id,
        eventType: outEvent.eventType,
        method: outEvent.method,
        recordedAt: outEvent.recordedAt,
        distanceMeters: distanceFromWorkplaceMeters,
        approvalStatus: outEvent.approvalStatus,
      },
    };
  }

  /**
   * Lấy lịch sử chấm công theo tháng
   */
  async getHistory(employeeId: string, organizationId: string, monthStr?: string) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const empObjectId = new Types.ObjectId(employeeId);

    // monthStr ví dụ '2026-09'
    const targetMonth = monthStr || this.getTodayWorkDate().substring(0, 7);
    const regex = new RegExp(`^${targetMonth}`);

    const days = await this.attendanceDayModel
      .find({
        organizationId: orgObjectId,
        employeeId: empObjectId,
        workDate: { $regex: regex },
      })
      .sort({ workDate: -1 })
      .lean();

    return {
      month: targetMonth,
      totalDays: days.length,
      items: days,
    };
  }

  /**
   * Tải evidence stream có kiểm tra quyền
   */
  async getEvidenceStream(evidenceId: string, userId: string, organizationId: string) {
    const evidence = await this.evidenceModel.findOne({
      _id: new Types.ObjectId(evidenceId),
      organizationId: new Types.ObjectId(organizationId),
    });

    if (!evidence) {
      throw new NotFoundException('RESOURCE_NOT_FOUND');
    }

    const stream = await this.storageService.download(evidence.storageKey);
    return {
      stream,
      mimeType: evidence.mimeType,
      originalFileName: evidence.originalFileName,
    };
  }

  private validateImageFile(file: Express.Multer.File) {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
    }
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('FILE_TOO_LARGE');
    }
  }

  private async createApprovalRequestForManager(
    organizationId: Types.ObjectId,
    userId: Types.ObjectId,
    departmentId: Types.ObjectId | undefined,
    attendanceDayId: Types.ObjectId,
    workDate: string,
    actionType: 'CHECK_IN' | 'CHECK_OUT',
    reasonText: string,
    evidenceId?: Types.ObjectId,
    metadata?: Record<string, any>,
  ) {
    try {
      // 1. Tìm EmployeeProfile theo userId
      let profile: any = await this.employeeProfileModel.findOne({ organizationId, userId }).lean();
      let empId = profile?._id;
      let deptId = departmentId || profile?.departmentId;

      if (!deptId) {
        // Tìm department từ assignment nếu profile chưa có
        const assign: any = await this.assignmentModel.findOne({ organizationId, userId, active: true }).lean();
        deptId = assign?.departmentId;
      }

      // Đảm bảo có lý do ít nhất 10 ký tự theo validation của Schema
      let reason = reasonText;
      if (!reason || reason.trim().length < 10) {
        reason = actionType === 'CHECK_IN'
          ? 'Chấm công Selfie xác thực ngoài văn phòng khi vào ca'
          : 'Chấm công Selfie xác thực ngoài văn phòng khi tan ca';
      }

      const created = await this.managerRequestModel.create({
        organizationId,
        departmentId: deptId,
        employeeId: empId || userId,
        employeeUserId: userId,
        type: 'ATTENDANCE',
        workDate: new Date(workDate),
        reason,
        status: 'PENDING',
        version: 1,
        attendanceDayId,
        evidenceId,
        metadata: {
          ...metadata,
          actionType,
        },
      });

      // Phát thông báo Realtime tới Quản lý phòng ban
      try {
        const empProfile: any = await this.employeeProfileModel.findOne({ organizationId, userId }).lean();
        if (deptId) {
          this.eventsGateway?.notifyNewRequest(String(deptId), {
            requestId: created._id.toString(),
            type: 'ATTENDANCE',
            departmentId: String(deptId),
            employeeUserId: userId.toString(),
            employeeName: empProfile?.fullName || 'Nhân viên',
            employeeCode: empProfile?.employeeCode || '',
            actionType,
            workDate,
            reason,
            status: 'PENDING',
            createdAt: created.createdAt || new Date(),
          });
        }
      } catch (wsErr) {
        console.warn('[AttendanceService] notifyNewRequest error:', wsErr);
      }
    } catch (err) {
      console.error('[AttendanceService] Failed to create ManagerRequest:', err);
    }
  }

  /**
   * Tự động nhận diện địa chỉ từ tọa độ GPS (Photon / BigDataCloud) nếu client chưa có hoặc gửi fallback tọa độ
   */
  private async resolveLocationAddress(
    lat?: number,
    lng?: number,
    clientAddress?: string,
    workplaceAddress?: string,
  ): Promise<string | undefined> {
    if (clientAddress && !clientAddress.startsWith('📍') && !clientAddress.toLowerCase().includes('tọa độ:')) {
      return clientAddress;
    }

    if (lat !== undefined && lng !== undefined) {
      // 1. Photon Reverse (OpenStreetMap)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          const p = data.features?.[0]?.properties;
          if (p) {
            const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
            const district = p.district || p.locality || p.suburb;
            const city = p.city || p.state;
            const parts = [street, district, city].filter(Boolean);
            if (parts.length > 0) return parts.join(', ');
          }
        }
      } catch {
        // Fallback to BigDataCloud
      }

      // 2. BigDataCloud Reverse
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: any = await res.json();
          const admin: any[] = data.localityInfo?.administrative || [];
          const info: any[] = data.localityInfo?.informative || [];
          const ward =
            admin.find((a: any) => a.adminLevel === 6 || a.name?.includes('Phường') || a.name?.includes('Xã'))?.name ||
            data.locality;
          const district =
            info.find(
              (i: any) =>
                i.name?.startsWith('Thành phố ') || i.name?.startsWith('Quận ') || i.name?.startsWith('Huyện '),
            )?.name || admin.find((a: any) => a.adminLevel === 5)?.name;
          const province = data.city || data.principalSubdivision;
          const parts = [ward, district, province].filter(Boolean);
          const uniqueParts: string[] = [];
          for (const part of parts) {
            if (!uniqueParts.some((p) => p.includes(part) || part.includes(p))) {
              uniqueParts.push(part);
            }
          }
          if (uniqueParts.length > 0) return uniqueParts.join(', ');
        }
      } catch {
        // Fallback
      }
    }

    return workplaceAddress || clientAddress || undefined;
  }
}
