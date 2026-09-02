const { Router } = require('express');
const ctrl = require('../controllers/render.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = Router();

// Mounted at '/' in routes/index.js — see docker/nginx/*.conf for the
// root-path proxy that routes real browser/crawler traffic here for these
// 4 shapes only. Everything else stays on nginx's normal SPA catch-all.
router.get('/_render/', asyncHandler(ctrl.home));
router.get('/_render/temples/:slug', asyncHandler(ctrl.temple));
router.get('/_render/services/:slug', asyncHandler(ctrl.service));
router.get('/_render/pandits/:slug', asyncHandler(ctrl.pandit));

// Static directory/utility pages — no DB lookup, same metadata for every
// request, so no NOT_FOUND branch is possible for these (unlike the 4
// entity shapes above).
router.get('/_render/services-list', asyncHandler(ctrl.servicesList));
router.get('/_render/temples-list', asyncHandler(ctrl.templesList));
router.get('/_render/pandits-list', asyncHandler(ctrl.panditsList));
router.get('/_render/ai-recommender', asyncHandler(ctrl.aiRecommender));
router.get('/_render/how-it-works', asyncHandler(ctrl.howItWorks));

module.exports = router;
