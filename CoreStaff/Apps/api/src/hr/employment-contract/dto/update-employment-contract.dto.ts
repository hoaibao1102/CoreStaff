import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateEmploymentContractDto } from './create-employment-contract.dto';

/**
 * Update edits only mutable HR fields. `employeeId` / `contractType` are
 * immutable after creation; `status` is never set directly — it moves through
 * PATCH /:id/status against `CONTRACT_STATUS_TRANSITIONS` (TASK-030).
 */
export class UpdateEmploymentContractDto extends PartialType(
	OmitType(CreateEmploymentContractDto, ['employeeId', 'contractType'] as const),
) {}