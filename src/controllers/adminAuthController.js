const asyncHandler = require('../utils/asyncHandler');
const { recordAdminAction } = require('../services/adminAudit');
const me = asyncHandler(async (req, res) => res.json({ success: true, data: { admin: { email: req.admin.email, scope: req.admin.scope } } }));
const logout = asyncHandler(async (req, res) => {
  await recordAdminAction({ req, action: 'admin.logout', targetType: 'admin', summary: 'Administrator signed out' });
  res.json({ success: true, message: 'Logged out' });
});

module.exports = { me, logout };
