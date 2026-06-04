import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAppleDevice extends Document {
  deviceLibraryIdentifier: string;
  pushToken: string;
  serialNumber: string;
  passTypeIdentifier: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppleDeviceSchema = new Schema(
  {
    deviceLibraryIdentifier: { type: String, required: true },
    pushToken: { type: String, required: true },
    serialNumber: { type: String, required: true, index: true },
    passTypeIdentifier: { type: String, required: true },
  },
  { timestamps: true }
);

AppleDeviceSchema.index({ deviceLibraryIdentifier: 1, serialNumber: 1 }, { unique: true });

const AppleDevice: Model<IAppleDevice> =
  mongoose.models.AppleDevice ||
  mongoose.model<IAppleDevice>('AppleDevice', AppleDeviceSchema);

export default AppleDevice;
