import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITable extends Document {
  number: number;
  name?: string;
  capacity: number;
  businessId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    number: { type: Number, required: true },
    name: { type: String },
    capacity: { type: Number, default: 4 },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TableSchema.index({ businessId: 1, number: 1 }, { unique: true });

const Table: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>('Table', TableSchema);

export default Table;
