import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';
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
import { ShiftResolverService } from '../hr/shift-template/shift-resolver.service';
import { OvertimeService } from '../hr/overtime/overtime.service';

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
    @InjectModel('IdempotencyRecord') private idempotencyModel: Model<any>,
    private haversineService: HaversineService,
    private networkValidatorService: NetworkValidatorService,
    private calculatorService: AttendanceCalculatorService,
    private storageService: StorageService,
    private shiftResolver: ShiftResolverService,
    @Optional() private readonly eventsGateway?: EventsGateway,
    // TASK-069 — last so positional construction in existing specs is unaffected.
    @Optional() private readonly overtime?: OvertimeService,
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
    const shift = await this.shiftResolver.resolveForEmployeeDate(organizationId, employeeId, workDate) || assignment?.shiftTemplateId || assignment?.shiftId;

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

  private requestHash(operation: 'CHECK_IN' | 'CHECK_OUT', dto: unknown, file?: Express.Multer.File): string {
    return createHash('sha256')
      .update(JSON.stringify({ operation, dto, file: file ? createHash('sha256').update(file.buffer).digest('hex') : null }))
      .digest('hex');
  }

  private async idempotencyReplay(
    organizationId: string,
    userId: string,
    key: string | undefined,
    operation: 'CHECK_IN' | 'CHECK_OUT',
    hash: string,
  ) {
    if (!key?.trim()) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    const existing: any = await this.idempotencyModel.findOne({ organizationId, userId, key: key.trim() }).lean();
    if (!existing) return null;
    if (existing.operation !== operation || existing.requestHash !== hash) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }
    return existing.responseBody;
  }

  private async saveIdempotency(
    organizationId: string,
    userId: string,
    key: string,
    operation: 'CHECK_IN' | 'CHECK_OUT',
    requestHash: string,
    responseBody: Record<string, unknown>,
  ) {
    await this.idempotencyModel.create({
      organizationId,
      userId,
      key: key.trim(),
      operation,
      requestHash,
      responseStatus: 200,
      responseBody,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
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
    idempotencyKey?: string,
  ) {
    const requestHash = this.requestHash('CHECK_IN', dto, file);
    const replay = await this.idempotencyReplay(organizationId, employeeId, idempotencyKey, 'CHECK_IN', requestHash);
    if (replay) return replay;
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
    const shift = await this.shiftResolver.resolveForEmployeeDate(organizationId, employeeId, workDate) || assignment.shiftTemplateId || assignment.shiftId;
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
        } catch (uploadErr: any) {
          console.error('[AttendanceService] Storage upload failed:', uploadErr);
          throw new InternalServerErrorException('EVIDENCE_STORAGE_UPLOAD_FAILED');
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

    const response = {
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
    await this.saveIdempotency(organizationId, employeeId, idempotencyKey!, 'CHECK_IN', requestHash, response as any);
    return response;
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
    idempotencyKey?: string,
  ) {
    const requestHash = this.requestHash('CHECK_OUT', dto, file);
    const replay = await this.idempotencyReplay(organizationId, employeeId, idempotencyKey, 'CHECK_OUT', requestHash);
    if (replay) return replay;
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
        } catch (uploadErr: any) {
          console.error('[AttendanceService] Storage upload failed:', uploadErr);
          throw new InternalServerErrorException('EVIDENCE_STORAGE_UPLOAD_FAILED');
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

    // TASK-069 — an OT day approved before today may now have real punches.
    // Fire-and-forget like the WS notifies: the day's own check-out must never
    // fail because a derived figure could not be refreshed.
    if (this.overtime) {
      this.overtime.recomputeForDay(organizationId, employeeId, workDate).catch((otErr) => {
        console.warn('[AttendanceService] overtime recomputeForDay error:', otErr);
      });
      // D39 — the punch also measures the hours nobody filed. §30B only counts
      // approved minutes, so unreported time outside the shift is invisible to
      // the cap unless something looks at the clock-out directly. Warning only:
      // the hours are already worked, and blocking a check-out over them would
      // punish the employee for work the manager asked for on site (D38).
      this.overtime.unreportedOvertimeMinutes(organizationId, employeeId, workDate)
        .then((flag) => {
          if (!flag) return;
          const departmentId = day.employeeSnapshot?.departmentId ?? assignment?.departmentId?._id ?? assignment?.departmentId;
          this.eventsGateway?.notifyComplianceWarning(employeeId, organizationId, departmentId, {
            workDate,
            employeeUserId: employeeId,
            unreportedOvertimeMinutes: flag.unreportedMinutes,
            workedTo: flag.workedTo,
            reason: 'UNREPORTED_OVERTIME',
          });
        })
        .catch((flagErr) => {
          console.warn('[AttendanceService] overtime unreportedOvertimeMinutes error:', flagErr);
        });
    }

    const response = {
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
    await this.saveIdempotency(organizationId, employeeId, idempotencyKey!, 'CHECK_OUT', requestHash, response as any);
    return response;
  }

  /**
   * Lấy lịch sử chấm công theo tháng
   */
  async getHistory(employeeId: string, organizationId: string, monthStr?: string) {
    const orgObjectId = new Types.ObjectId(organizationId);
    const empObjectId = new Types.ObjectId(employeeId);

    // monthStr ví dụ '2026-09'
    const targetMonth = monthStr || this.getTodayWorkDate().substring(0, 7);
    const startMonthStr = `${targetMonth}-01`;
    const endMonthStr = `${targetMonth}-31`;

    const startOfMonth = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const [y, m] = targetMonth.split('-').map(Number);
    const endOfMonth = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));

    // Chạy song song query days, otRequests và results đã tính, sử dụng B-tree index
    const [days, otRequests, otResults]: [any[], any[], any[]] = await Promise.all([
      this.attendanceDayModel
        .find({
          organizationId: orgObjectId,
          employeeId: empObjectId,
          workDate: { $gte: startMonthStr, $lte: endMonthStr },
        })
        .sort({ workDate: -1 })
        .lean(),
      this.managerRequestModel
        .find({
          organizationId: orgObjectId,
          $or: [{ employeeUserId: empObjectId }, { employeeId: empObjectId }],
          type: 'OVERTIME',
          status: 'APPROVED',
          workDate: { $gte: startOfMonth, $lt: endOfMonth },
        })
        .lean(),
      // Absent when AttendanceModule is loaded without OvertimeModule.
      this.overtime?.resultsForRange(organizationId, employeeId, startMonthStr, endMonthStr) ?? Promise.resolve([]),
    ]);

    const dayIds = days.map((d) => d._id);
    const events: any[] = dayIds.length > 0
      ? await this.attendanceEventModel
          .find({
            organizationId: orgObjectId,
            attendanceDayId: { $in: dayIds },
          })
          .populate('evidenceId')
          .lean()
      : [];

    let totalWorkingMinutes = 0;
    let totalLateDays = 0;
    let totalEarlyDays = 0;
    let totalOtMinutes = 0;

    // Keyed by requestId — one current result per approved request (the unique
    // (organizationId, overtimeRequestId) index guarantees that).
    const dayResults = new Map(otResults.map((r) => [String(r.overtimeRequestId), r]));

    const items = days.map((day) => {
      const dayEvents = events.filter((e) => String(e.attendanceDayId) === String(day._id));
      const inEvt = dayEvents.find((e) => e.eventType === AttendanceEventType.CHECK_IN);
      const outEvt = dayEvents.find((e) => e.eventType === AttendanceEventType.CHECK_OUT);

      const dayOt = otRequests.find((ot) => {
        const otDateStr = new Date(ot.workDate).toISOString().slice(0, 10);
        return otDateStr === day.workDate;
      });

      let otInfo = null;
      if (dayOt) {
        // TASK-069/AC-OT-04 — the number the day shows is the *eligible* one the
        // engine derived from real punches, not the approved window's wall-clock
        // length (which paid out minutes nobody worked).
        const result = dayResults.get(String(dayOt._id));
        let otMinutes = result?.eligibleMinutes ?? 0;
        if (!result) {
          // Pre-TASK-069 approval with no stored result: fall back to the window,
          // floored like the engine, until `POST /api/hr/overtime-results/recalculate`
          // backfills it.
          const start = dayOt.approvedStart || dayOt.requestedStart;
          const end = dayOt.approvedEnd || dayOt.requestedEnd;
          if (start && end) {
            otMinutes = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000));
          }
        }
        totalOtMinutes += otMinutes;

        otInfo = {
          requestId: dayOt._id,
          status: dayOt.status,
          requestedStart: dayOt.requestedStart,
          requestedEnd: dayOt.requestedEnd,
          approvedStart: dayOt.approvedStart,
          approvedEnd: dayOt.approvedEnd,
          reason: dayOt.reason,
          reviewComment: dayOt.reviewComment,
          reviewedAt: dayOt.reviewedAt,
          otMinutes,
          overtimeType: result?.overtimeType ?? null,
          actualMinutes: result?.actualMinutes ?? 0,
          classificationStatus: result?.classificationStatus ?? null,
        };
      }

      if (day.workingMinutes) totalWorkingMinutes += day.workingMinutes;
      if (day.lateMinutes > 0) totalLateDays++;
      if (day.earlyMinutes > 0) totalEarlyDays++;

      return {
        ...day,
        checkIn: inEvt
          ? {
              eventId: inEvt._id,
              eventType: inEvt.eventType,
              method: inEvt.method,
              recordedAt: inEvt.recordedAt,
              address: inEvt.address,
              distanceMeters: inEvt.distanceFromWorkplaceMeters,
              accuracyMeters: inEvt.accuracyMeters,
              latitude: inEvt.latitude,
              longitude: inEvt.longitude,
              approvalStatus: inEvt.approvalStatus,
              evidenceUrl: inEvt.evidenceId ? `/api/attendance/evidence/${inEvt.evidenceId._id || inEvt.evidenceId}` : null,
            }
          : null,
        checkOut: outEvt
          ? {
              eventId: outEvt._id,
              eventType: outEvt.eventType,
              method: outEvt.method,
              recordedAt: outEvt.recordedAt,
              address: outEvt.address,
              distanceMeters: outEvt.distanceFromWorkplaceMeters,
              accuracyMeters: outEvt.accuracyMeters,
              latitude: outEvt.latitude,
              longitude: outEvt.longitude,
              approvalStatus: outEvt.approvalStatus,
              evidenceUrl: outEvt.evidenceId ? `/api/attendance/evidence/${outEvt.evidenceId._id || outEvt.evidenceId}` : null,
            }
          : null,
        overtime: otInfo,
      };
    });

    return {
      month: targetMonth,
      totalDays: items.length,
      summary: {
        workingDays: items.filter((d) => d.attendanceStatus === AttendanceStatus.COMPLETED || d.attendanceStatus === AttendanceStatus.CHECKED_IN).length,
        totalWorkingMinutes,
        lateDays: totalLateDays,
        earlyDays: totalEarlyDays,
        otMinutes: totalOtMinutes,
        otDays: items.filter((d) => Boolean(d.overtime)).length,
      },
      items,
    };
  }

  /**
   * Tải evidence stream có kiểm tra quyền
   */
  async getEvidenceStream(
    evidenceId: string,
    actor: { userId: string; organizationId: string; role: string },
  ) {
    const evidence = await this.evidenceModel.findOne({
      _id: new Types.ObjectId(evidenceId),
      organizationId: new Types.ObjectId(actor.organizationId),
    }).lean();

    if (!evidence) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const ownsEvidence = String(evidence.ownerUserId) === String(actor.userId);
    let authorized = ownsEvidence || actor.role === 'HR';

    if (!authorized && actor.role === 'DEPARTMENT_MANAGER') {
      const request: any = await this.managerRequestModel.findOne({
        organizationId: new Types.ObjectId(actor.organizationId),
        evidenceId: new Types.ObjectId(evidenceId),
      }).lean();
      if (request?.departmentId) {
        const now = new Date();
        const assignment: any = await this.managerAssignmentModel.findOne({
          organizationId: new Types.ObjectId(actor.organizationId),
          managerUserId: new Types.ObjectId(actor.userId),
          departmentId: request.departmentId,
          active: true,
        }).lean();
        authorized = Boolean(
          assignment
          && (!assignment.effectiveFrom || new Date(assignment.effectiveFrom) <= now)
          && (!assignment.effectiveTo || new Date(assignment.effectiveTo) >= now),
        );
      }
    }

    if (!authorized) throw new NotFoundException('RESOURCE_NOT_FOUND');

    const stream = await this.storageService.download(evidence.storageKey);
    return { stream, mimeType: evidence.mimeType, originalFileName: evidence.originalFileName };
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
