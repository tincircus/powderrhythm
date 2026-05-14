'use strict';

// TODO: Implement shared-password authentication in Phase 2
// Apply as route middleware: router.use(requireAuth)
// Password source: process.env.ADMIN_PASSWORD

module.exports = function requireAuth(req, res, next) {
  next(); // stub — no auth this phase
};
