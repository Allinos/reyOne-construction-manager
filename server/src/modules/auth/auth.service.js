'use strict';

const repo = require('./auth.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { comparePassword, hashPassword } = require('../../core/utils/password');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} = require('../../core/utils/jwt');

function permissionKeys(user) {
  return user.role.permissions.map((rp) => rp.permission.key);
}

function toProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    designation: user.designation,
    status: user.status,
    role: { id: user.role.id, key: user.role.key, name: user.role.name },
    permissions: permissionKeys(user),
  };
}

async function issueTokens(user) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role.key });
  const refreshToken = signRefreshToken({ sub: user.id });

  const decoded = verifyRefreshToken(refreshToken);
  await repo.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
  });

  return { accessToken, refreshToken };
}

const authService = {
  async login(email, password, req) {
    const user = await repo.findUserByEmail(email);
    // Same message whether the email or password is wrong (no user enumeration).
    if (!user) throw AppError.unauthorized('Invalid email or password');
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Account is not active');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw AppError.unauthorized('Invalid email or password');

    const tokens = await issueTokens(user);
    activity.record({ userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, req });
    return { user: toProfile(user), ...tokens };
  },

  async refresh(refreshToken) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await repo.findRefreshToken(tokenHash);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token is no longer valid');
    }

    const user = await repo.findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw AppError.unauthorized('User is not available');

    // Rotate: revoke the used token, issue a fresh pair.
    await repo.revokeRefreshToken(tokenHash);
    const tokens = await issueTokens(user);
    return { user: toProfile(user), ...tokens };
  },

  async logout(refreshToken) {
    if (refreshToken) {
      await repo.revokeRefreshToken(hashToken(refreshToken));
    }
    return { success: true };
  },

  async me(userId) {
    const user = await repo.findUserById(userId);
    if (!user) throw AppError.notFound('User not found');
    return toProfile(user);
  },

  async changePassword(userId, currentPassword, newPassword, req) {
    const user = await repo.findUserById(userId);
    if (!user) throw AppError.notFound('User not found');

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) throw AppError.badRequest('Current password is incorrect');

    await repo.updatePassword(userId, await hashPassword(newPassword));
    // Force re-login everywhere else.
    await repo.revokeAllForUser(userId);
    activity.record({ userId, action: 'auth.password_changed', entityType: 'user', entityId: userId, req });
    return { success: true };
  },
};

module.exports = authService;
