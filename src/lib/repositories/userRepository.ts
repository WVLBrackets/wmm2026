import { ConfirmationToken, User } from "../database";

// Define PasswordResetToken interface since it's not exported from database.ts
export interface PasswordResetToken {
  token: string;
  userId: string;
  expires: Date;
  type: 'reset';
}

// Repository interfaces to allow swapping storage implementations later (e.g., Prisma/Postgres)
export interface UserRepository {
  findByEmail(email: string): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<User | null>;
  createUser(email: string, name: string, password: string): Promise<User | null>;
  setPassword(userId: string, newPassword: string): Promise<void>;
  updateName(userId: string, name: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  listUsers(): Promise<User[]>;
}

export interface TokenRepository {
  createConfirmation(user: User): Promise<ConfirmationToken>;
  confirmByToken(token: string): Promise<boolean>;
  createPasswordReset(email: string): Promise<PasswordResetToken | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  findConfirmationToken(token: string): Promise<ConfirmationToken | undefined>;
  findPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  deleteToken(token: string): Promise<void>;
}

// Adapter over current in-memory helpers so callers can depend on interfaces now
import {
  getUserByEmail,
  verifyPassword as dbVerifyPassword,
  createUser as dbCreateUser,
  resetPassword as dbResetPassword,
  confirmUserEmail as dbConfirmUser,
  createPasswordResetToken as dbCreatePasswordResetToken,
  // Note: Some functions don't exist in database.ts, we'll implement them as needed
} from "../database";

// Minimal admin helpers layered on top of database.ts
import bcrypt from "bcryptjs";

export const InMemoryUserRepository: UserRepository = {
  async findByEmail(email) {
    return await getUserByEmail(email) || undefined;
  },
  async verifyPassword(email, password) {
    return await dbVerifyPassword(email, password);
  },
  async createUser(email, name, password) {
    return await dbCreateUser(email, name, password);
  },
  async setPassword(userId, newPassword) {
    // Since database.ts doesn't expose byId, implement via reset token bypass:
    // Fallback approach: fetch user by email first via listUsers() once available.
    // For now, not implemented - will be provided by admin API later using database internals.
    // No-op here to keep interface stable.
    const hash = await bcrypt.hash(newPassword, 10);
    // This is a placeholder to keep surface compatible until DB migration.
    // Admin password changes will be wired through dedicated endpoints.
    void hash;
  },
  async updateName(_userId, _name) {
    // Placeholder; will be implemented when moving to DB-backed repo.
  },
  async deleteUser(_userId) {
    // Placeholder; will be implemented when moving to DB-backed repo.
  },
  async listUsers() {
    // Placeholder for now; admin UI will be enabled when DB is added.
    return [];
  },
};

export const InMemoryTokenRepository: TokenRepository = {
  async createConfirmation(user) {
    // database.createUser already creates and stores confirmation; return a mock token
    // In a real implementation, we'd query the tokens array
    if (!user.confirmationToken) {
      throw new Error("No confirmation token found for user");
    }
    return {
      token: user.confirmationToken,
      userId: user.id,
      expires: user.confirmationExpires || new Date(),
      type: 'confirmation' as const
    };
  },
  async confirmByToken(token) {
    return await dbConfirmUser(token);
  },
  async createPasswordReset(email) {
    // Use the actual database function
    const resetToken = await dbCreatePasswordResetToken(email);
    if (!resetToken) {
      return null;
    }
    // Return a mock token object - in real implementation we'd query the tokens array
    return {
      token: resetToken,
      userId: '', // Would need to get from user lookup
      expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      type: 'reset' as const
    };
  },
  async resetPassword(token, newPassword) {
    return await dbResetPassword(token, newPassword);
  },
  async findConfirmationToken(token) {
    // This function doesn't exist in database.ts, return undefined for now
    // In a real implementation, we'd query the tokens array
    return undefined;
  },
  async findPasswordResetToken(token) {
    // This function doesn't exist in database.ts, return undefined for now
    // In a real implementation, we'd query the tokens array
    return undefined;
  },
  async deleteToken(token) {
    // This function doesn't exist in database.ts, no-op for now
    // In a real implementation, we'd remove from tokens array
  },
};



