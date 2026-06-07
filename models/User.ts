import mongoose, { Schema, Document, Model } from 'mongoose';

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  businessId: string; // Store as string to match Better Auth format
  image?: string;
  emailVerified?: Date;
  employeeNumber?: string;
  /** Hashed POS PIN (scrypt) used to identify a waiter on a trusted terminal. */
  pinHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String }, // Optional if using OAuth
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STAFF,
    },
    businessId: {
      type: String, // Store as string (Better Auth format: business ObjectId as string)
      required: true,
      index: true,
    },
    image: { type: String },
    emailVerified: { type: Date },
    employeeNumber: { type: String },
    pinHash: { type: String },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
