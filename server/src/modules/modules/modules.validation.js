'use strict';

const { z } = require('zod');

const keyParam = z.object({ key: z.string().min(1).max(50) });
const toggleSchema = z.object({ enabled: z.boolean() });

module.exports = { keyParam, toggleSchema };
