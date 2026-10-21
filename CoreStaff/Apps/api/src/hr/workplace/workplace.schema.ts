/**
 * Compatibility export for older imports. Keep a single schema definition so
 * HR configuration and attendance always read/write the same fields.
 */
export {
  Workplace,
  WorkplaceSchema,
  WorkplaceType,
} from '../../database/schemas/workplace.schema';
export type {
  WorkplaceDocument,
  WorkplaceNetworkRule,
} from '../../database/schemas/workplace.schema';
