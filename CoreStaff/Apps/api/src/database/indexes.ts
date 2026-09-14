import { Schema } from 'mongoose';

/** A single index definition as reported by Mongoose (includes `_id_`). */
export interface IndexSpec {
  name?: string;
  key: Record<string, 1 | -1 | string>;
  unique?: boolean;
}

/**
 * Normalize Mongoose's `schema.indexes()` output into stable { key, unique }
 * records so tests and the index bootstrap read from one shape.
 */
export function listIndexes(schema: Schema): IndexSpec[] {
  return schema.indexes().map((raw) => {
    // First entry is the key map; unique is either in a second object or as flags.
    const key = (raw[0] ?? {}) as Record<string, 1 | -1 | string>;
    const options = ((raw.length > 1 && typeof raw[1] === 'object' ? raw[1] : {}) ?? {}) as {
      unique?: boolean;
      sparse?: boolean;
      name?: string;
    };
    return { key, unique: options.unique, name: options.name };
  });
}

/** Case-insensitive check that a compound index key exists. */
export function hasCompoundIndex(schema: Schema, keys: string[], unique?: boolean): boolean {
  return listIndexes(schema).some((idx) => {
    const idxKeys = Object.keys(idx.key);
    const hasKeys = keys.every((k) => idxKeys.includes(k));
    const matchUnique = unique === undefined || Boolean(idx.unique) === unique;
    return hasKeys && matchUnique;
  });
}