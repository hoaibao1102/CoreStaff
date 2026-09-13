import { Schema } from 'mongoose';
import { OrganizationSchema } from './organization.schema';
import { UserSchema } from './user.schema';
import { UserSessionSchema } from './user-session.schema';

/**
 * Single source of truth for the collections bootstrapped by TASK-015.
 * Reused by both the NestJS `DatabaseModule` and the `ensure-indexes` CLI so a
 * schema is never defined in two places.
 */
export const SCHEMA_REGISTRY: Array<{ name: string; schema: Schema }> = [
  { name: 'Organization', schema: OrganizationSchema },
  { name: 'User', schema: UserSchema },
  { name: 'UserSession', schema: UserSessionSchema },
];

export { OrganizationSchema, UserSchema, UserSessionSchema };
export { Organization } from './organization.schema';
export { User } from './user.schema';
export { UserSession } from './user-session.schema';

export function registryEntries() {
  return SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema } as const));
}