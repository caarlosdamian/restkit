import AppleDevice, { IAppleDevice } from '@/models/AppleDevice';

export const appleDeviceRepository = {
  async upsert(
    deviceLibraryIdentifier: string,
    serialNumber: string,
    passTypeIdentifier: string,
    pushToken: string
  ): Promise<{ created: boolean }> {
    const result = await AppleDevice.updateOne(
      { deviceLibraryIdentifier, serialNumber },
      { $set: { pushToken, passTypeIdentifier } },
      { upsert: true }
    );
    return { created: result.upsertedCount > 0 };
  },

  async remove(deviceLibraryIdentifier: string, serialNumber: string): Promise<boolean> {
    const result = await AppleDevice.deleteOne({ deviceLibraryIdentifier, serialNumber });
    return result.deletedCount === 1;
  },

  async findByDevice(
    deviceLibraryIdentifier: string,
    passTypeIdentifier: string
  ): Promise<IAppleDevice[]> {
    return AppleDevice.find({ deviceLibraryIdentifier, passTypeIdentifier });
  },

  async findBySerialNumber(serialNumber: string): Promise<IAppleDevice[]> {
    return AppleDevice.find({ serialNumber });
  },
};
