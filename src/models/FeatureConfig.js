const mongoose = require('mongoose');
const featureConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default' },
  registrationEnabled: { type: Boolean, default: true },
  poetryPublishing: { type: Boolean, default: true },
  comments: { type: Boolean, default: true },
  privateSubscriptions: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  externalPoetry: { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.models.FeatureConfig || mongoose.model('FeatureConfig', featureConfigSchema);
