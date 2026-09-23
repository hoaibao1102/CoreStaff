import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { NetworkValidatorService } from './services/network-validator.service';

@Controller('attendance')
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly networkValidatorService: NetworkValidatorService,
  ) {}

  private getUserId(req: any): string {
    return req.user?._id?.toString() || req.user?.userId || req.user?.id || req.user?.sub;
  }

  @Get('today')
  async getToday(@Req() req: any) {
    const userId = this.getUserId(req);
    const organizationId = req.user?.organizationId;
    const data = await this.attendanceService.getTodayState(userId, organizationId);
    return { success: true, data };
  }

  @Post('check-in')
  @UseInterceptors(FileInterceptor('selfie'))
  async checkIn(
    @Req() req: any,
    @Body() dto: CheckInDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    const organizationId = req.user.organizationId;
    const clientIp = this.networkValidatorService.extractClientIp(req);
    const userAgent = req.headers['user-agent'];

    // Nếu gửi từ FormData, các trường số có thể ở dạng string, chuyển đổi an toàn
    if (typeof dto.latitude === 'string') dto.latitude = parseFloat(dto.latitude);
    if (typeof dto.longitude === 'string') dto.longitude = parseFloat(dto.longitude);
    if (typeof dto.accuracyMeters === 'string') dto.accuracyMeters = parseFloat(dto.accuracyMeters);

    const data = await this.attendanceService.checkIn(
      userId,
      organizationId,
      dto,
      file,
      clientIp,
      userAgent,
      idempotencyKey,
    );
    return { success: true, data };
  }

  @Post('check-out')
  @UseInterceptors(FileInterceptor('selfie'))
  async checkOut(
    @Req() req: any,
    @Body() dto: CheckOutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    const organizationId = req.user.organizationId;
    const clientIp = this.networkValidatorService.extractClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (typeof dto.latitude === 'string') dto.latitude = parseFloat(dto.latitude);
    if (typeof dto.longitude === 'string') dto.longitude = parseFloat(dto.longitude);
    if (typeof dto.accuracyMeters === 'string') dto.accuracyMeters = parseFloat(dto.accuracyMeters);

    const data = await this.attendanceService.checkOut(
      userId,
      organizationId,
      dto,
      file,
      clientIp,
      userAgent,
      idempotencyKey,
    );
    return { success: true, data };
  }

  @Get('history')
  async getHistory(@Req() req: any, @Query('month') month?: string) {
    const userId = this.getUserId(req);
    const organizationId = req.user.organizationId;
    const data = await this.attendanceService.getHistory(userId, organizationId, month);
    return { success: true, data };
  }

  @Get('evidence/:id')
  async getEvidence(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const userId = this.getUserId(req);
    const organizationId = req.user.organizationId;
    const { stream, mimeType } = await this.attendanceService.getEvidenceStream(id, {
      userId,
      organizationId,
      role: req.user.role,
    });
    res.setHeader('Content-Type', mimeType);
    stream.pipe(res);
  }
}
