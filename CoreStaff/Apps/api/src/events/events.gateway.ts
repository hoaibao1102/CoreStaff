import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../database/schemas/user.schema';
import { UserSessionDocument } from '../database/schemas/user-session.schema';
import { ManagerAssignmentDocument } from '../database/schemas/manager-assignment.schema';
import { getCookie } from '../common/parse-cookies';
import { hashToken } from '../auth/strategies/token-strategy';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Cho phép origin từ client và credentials
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('UserSession') private readonly sessionModel: Model<UserSessionDocument>,
    @InjectModel('ManagerAssignment') private readonly managerAssignmentModel: Model<ManagerAssignmentDocument>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const rawCookie = client.handshake.headers.cookie;
      const sid = getCookie(rawCookie, 'sid');

      if (!sid) return;

      const tokenHash = hashToken(sid);
      const session = await this.sessionModel
        .findOne({
          tokenHash,
          revokedAt: null,
          expiresAt: { $gte: new Date() },
        })
        .lean();

      if (!session) return;

      const user = await this.userModel.findById(session.userId).lean();
      if (!user) return;

      const userIdStr = String(user._id);
      const orgIdStr = user.organizationId ? String(user.organizationId) : undefined;

      client.data.userId = userIdStr;
      client.data.role = user.role;
      client.data.organizationId = orgIdStr;

      // 1. Gia nhập room cá nhân của user
      client.join(`user:${userIdStr}`);

      // 2. Nếu là Quản lý phòng ban (DEPARTMENT_MANAGER) hoặc HR:
      if (user.role === 'DEPARTMENT_MANAGER' || user.role === 'HR') {
        if (orgIdStr) {
          client.join(`org:${orgIdStr}:managers`);

          // Tìm các phòng ban quản lý
          const managed = await this.managerAssignmentModel
            .find({
              organizationId: orgIdStr,
              managerUserId: userIdStr,
              active: true,
            })
            .lean();

          managed.forEach((m) => {
            const deptId = String(m.departmentId);
            client.join(`dept:${deptId}`);
          });
        }
      }
    } catch (err) {
      console.error('[EventsGateway] handleConnection error:', err);
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('register:user')
  async handleRegisterUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; role?: string; departmentId?: string },
  ) {
    if (data?.userId) {
      client.join(`user:${data.userId}`);
      if (data.departmentId) {
        client.join(`dept:${data.departmentId}`);
      }
      if (data.role === 'DEPARTMENT_MANAGER' || data.role === 'HR') {
        try {
          const managed = await this.managerAssignmentModel
            .find({
              managerUserId: data.userId,
              active: true,
            })
            .lean();

          managed.forEach((m) => {
            const deptId = String(m.departmentId);
            client.join(`dept:${deptId}`);
          });
        } catch {
          // ignore
        }
      }
    }
  }

  @SubscribeMessage('join:department')
  handleJoinDepartment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { departmentId: string },
  ) {
    if (data?.departmentId) {
      client.join(`dept:${data.departmentId}`);
    }
  }

  /**
   * Phát thông báo yêu cầu mới (Chấm công Selfie / OT) tới Quản lý phòng ban
   */
  notifyNewRequest(departmentId: string, payload: any) {
    if (!this.server) return;
    const deptRoom = `dept:${departmentId}`;
    this.server.to(deptRoom).emit('request:new', payload);
  }

  /**
   * Phát thông báo quyết định phê duyệt (Duyệt / Từ chối / Yêu cầu giải trình) tới Nhân viên
   */
  notifyApprovalDecision(employeeUserId: any, payload: any) {
    if (!this.server) return;
    const rawUid = employeeUserId?._id ?? employeeUserId;
    const uid = String(rawUid);
    const userRoom = `user:${uid}`;
    this.server.to(userRoom).emit('request:decided', payload);

    // Đồng thời cập nhật trạng thái trong phòng ban của Quản lý để bảng realtime
    if (payload?.departmentId) {
      const rawDeptId = payload.departmentId?._id ?? payload.departmentId;
      const deptId = String(rawDeptId);
      this.server.to(`dept:${deptId}`).emit('request:decided', payload);
    }
  }
}
