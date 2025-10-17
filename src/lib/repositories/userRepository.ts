import { ConfirmationToken, PasswordResetToken, User } from "../database";

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
  findUserByEmail,
  verifyPassword as dbVerifyPassword,
  createUser as dbCreateUser,
  resetPassword as dbResetPassword,
  confirmUser as dbConfirmUser,
  findConfirmationToken as dbFindConfirmationToken,
  findPasswordResetToken as dbFindPasswordResetToken,
  deleteToken as dbDeleteToken,
  // internal arrays are not exported; we provide minimal admin ops via helpers below
} from "../database";

// Minimal admin helpers layered on top of database.ts
import bcrypt from "bcryptjs";

export const InMemoryUserRepository: UserRepository = {
  async findByEmail(email) {
    return await findUserByEmail(email);
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
    // database.createUser already creates and stores confirmation; find and return it
    const token = await dbFindConfirmationToken(user.confirmationToken || "");
    if (!token) {
      throw new Error("Confirmation token not found for user");
    }
    return token;
  },
  async confirmByToken(token) {
    return await dbConfirmUser(token);
  },
  async createPasswordReset(email) {
    // database.ts already exposes createPasswordResetToken via API route; keep routes using database.ts directly for now
    // This adapter is reserved for future DB move
    return null;
  },
  async resetPassword(token, newPassword) {
    return await dbResetPassword(token, newPassword);
  },
  async findConfirmationToken(token) {
    return await dbFindConfirmationToken(token);
  },
  async findPasswordResetToken(token) {
    return await dbFindPasswordResetToken(token);
  },
  async deleteToken(token) {
    await dbDeleteToken(token);
  },
};



