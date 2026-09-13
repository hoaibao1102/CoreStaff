import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { resolveEnv, hasMongoUri } from '../config/env';
import { SCHEMA_REGISTRY } from './schemas/registry';

const env = resolveEnv();

const imports = hasMongoUri(env)
  ? [
      MongooseModule.forRoot(env.mongodbUri, {
        retryAttempts: 3,
        serverSelectionTimeoutMS: 15000,
      }),
      MongooseModule.forFeature(
        SCHEMA_REGISTRY.map(({ name, schema }) => ({ name, schema })),
      ),
    ]
  : [];

@Module({
  imports,
  exports: imports,
})
export class DatabaseModule {}