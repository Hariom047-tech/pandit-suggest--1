const { Router } = require('express');
const ctrl = require('../controllers/services.controller');
const { asyncHandler } = require('../middleware/asyncHandler');
const { optionalAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

const router = Router();

router.get('/', asyncHandler(ctrl.list));
// Before '/:id' — otherwise Express matches "categories" as a service slug.
router.get('/categories', asyncHandler(ctrl.homeCategories));
// Same rule: "popular" is a fixed path, not a slug.
router.get('/popular', asyncHandler(ctrl.popular));
router.get('/:id', asyncHandler(ctrl.getById));
// optionalAuth so a signed-in devotee's view is attributed to them rather
// than only to a browser key; the limiter is there because this is a public
// write, even though each row is deduped per visitor per hour.
router.post('/:id/view', authLimiter(60), optionalAuth, asyncHandler(ctrl.trackView));

module.exports = router;
