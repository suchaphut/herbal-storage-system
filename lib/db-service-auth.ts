import dbConnect from './mongodb'
import { UserModel } from './models'
import type { User } from './types'

export const authDbService = {
  // User Management
  async getUserByEmail(email: string): Promise<User | null> {
    await dbConnect()
    return await UserModel.findOne({ email: email.toLowerCase() }).lean()
  },

  async getUserById(id: string): Promise<User | null> {
    await dbConnect()
    return await UserModel.findById(id).lean()
  },

  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    await dbConnect()
    const user = await UserModel.create({
      ...userData,
      lastLogin: userData.lastLogin ?? null,
      loginAttempts: userData.loginAttempts ?? 0,
      lockedUntil: userData.lockedUntil ?? null,
    })
    return user.toObject() as User
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await dbConnect()
    return await UserModel.findByIdAndUpdate(id, updates, { new: true }).lean()
  },

  async deleteUser(id: string): Promise<boolean> {
    await dbConnect()
    const result = await UserModel.findByIdAndDelete(id)
    return !!result
  },

  async getAllUsers(includeInactive = false): Promise<User[]> {
    await dbConnect()
    const filter = includeInactive ? {} : { isActive: true }
    return await UserModel.find(filter).lean()
  },

  async getUsersByRole(role: 'admin' | 'operator' | 'viewer'): Promise<User[]> {
    await dbConnect()
    return await UserModel.find({ role, isActive: true }).lean()
  },

  async assignRoomToUser(userId: string, roomId: string): Promise<User | null> {
    await dbConnect()
    return await UserModel.findByIdAndUpdate(
      userId,
      { $addToSet: { assignedRooms: roomId } },
      { new: true }
    ).lean()
  },

  async removeRoomFromUser(userId: string, roomId: string): Promise<User | null> {
    await dbConnect()
    return await UserModel.findByIdAndUpdate(
      userId,
      { $pull: { assignedRooms: roomId } },
      { new: true }
    ).lean()
  },

}
