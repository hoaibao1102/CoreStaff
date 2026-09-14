import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateEmployeeProfileDto } from './create-employee-profile.dto';

/**
 * `userId` and `employeeCode` are immutable identity fields set at creation.
 * `employmentStatus`/`endDate` are not editable here — only via the dedicated
 * status-transition endpoint (TASK-023), so every status change is audited.
 */
export class UpdateEmployeeProfileDto extends PartialType(
	OmitType(CreateEmployeeProfileDto, ['userId', 'employeeCode'] as const),
) {}
