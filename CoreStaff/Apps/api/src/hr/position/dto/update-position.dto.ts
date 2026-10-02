import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePositionDto } from './create-position.dto';

/** A position never moves departments — only its code/name are editable. */
export class UpdatePositionDto extends PartialType(OmitType(CreatePositionDto, ['departmentId'] as const)) {}
