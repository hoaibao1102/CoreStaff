import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CalendarExceptionType } from './enums';

export type CalendarExceptionDocument = HydratedDocument<CalendarException>;

@Schema({ collection: 'calendar_exceptions', timestamps: true })
export class CalendarException {
  @Prop({ type: 'ObjectId', ref: 'Organization', required: true, index: true }) organizationId: string;
  @Prop({ required: true }) date: string;
  @Prop({ required: true, enum: Object.values(CalendarExceptionType) }) type: CalendarExceptionType;
  @Prop({ required: true, maxlength: 200 }) name: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: true }) createdBy: string;
  @Prop({ type: 'ObjectId', ref: 'User', required: false }) updatedBy?: string;
  @Prop() createdAt?: Date;
  @Prop() updatedAt?: Date;
}

export const CalendarExceptionSchema = SchemaFactory.createForClass(CalendarException);
CalendarExceptionSchema.index({ organizationId: 1, date: 1 }, { unique: true });

