'use strict';

const { z } = require('zod');

const chartsQuery = z.object({
  period: z.enum(['monthly', 'yearly']).optional(),
});

module.exports = { chartsQuery };
