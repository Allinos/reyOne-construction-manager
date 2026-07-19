'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../errors/AppError');
const { verifyAccessToken } = require('../utils/jwt');

/**
 * Verifies the Bearer access token, loads the user with role + permission keys,
 * and attaches a lightweight identity to req.user.
 */
const authenticate = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw AppError.unauthorized('Authentication required');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.status !== 'ACTIVE') throw AppError.forbidden('Account is not active');

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      roleKey: user.role.key,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
