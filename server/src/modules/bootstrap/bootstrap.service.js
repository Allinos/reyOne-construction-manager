'use strict';

const prisma = require('../../config/prisma');

/**
 * Aggregates everything the client needs to render itself for the logged-in
 * user: branding, enabled modules (drives nav + routes), public configuration
 * (lookups), and the user's identity + permissions.
 */
const bootstrapService = {
  async build(authUser) {
    const [company, modules, settingRows, user] = await Promise.all([
      prisma.company.findFirst(),
      prisma.module.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.setting.findMany(),
      prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          email: true,
          designation: true,
          role: { select: { id: true, key: true, name: true } },
        },
      }),
    ]);

    const settings = {};
    for (const s of settingRows) {
      (settings[s.group] ||= {})[s.key] = s.value;
    }

    return {
      user: { ...user, permissions: authUser.permissions },
      company,
      modules: modules.map((m) => ({
        key: m.key,
        name: m.name,
        isCore: m.isCore,
        sortOrder: m.sortOrder,
      })),
      settings,
    };
  },
};

module.exports = bootstrapService;
