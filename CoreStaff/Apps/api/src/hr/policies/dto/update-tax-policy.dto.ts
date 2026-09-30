import { PartialType } from '@nestjs/swagger';
import { CreateTaxPolicyDto } from './create-tax-policy.dto';

/**
 * TASK-041 — Update an existing TaxPolicy (version++).
 * All fields are optional; only provided fields will be updated.
 */
export class UpdateTaxPolicyDto extends PartialType(CreateTaxPolicyDto) {}
