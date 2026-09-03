const { Router } = require('express');
const ctrl = require('../../controllers/admin/siteImages.controller');
const { requireAdmin, adminHandler } = require('../../middleware/admin');

const router = Router();
router.use(requireAdmin);

router.get('/', adminHandler(ctrl.list));
// Multer runs before adminHandler so the multipart body is parsed (and an
// oversized file rejected) before a database transaction is opened — same
// ordering as the home hero route.
router.post('/:slotKey', ctrl.siteUpload, adminHandler(ctrl.upload));
router.patch('/:slotKey', adminHandler(ctrl.updateAlt));
router.delete('/:slotKey', adminHandler(ctrl.remove));

module.exports = router;
