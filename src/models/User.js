const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Maya Chen' },
    handle: { type: String, default: '@maya_poet' },
    bio: { type: String, default: 'Poet & Storyteller' },
    location: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    verified: { type: Boolean, default: false },
    since: { type: Number, default: new Date().getFullYear() },
  },
  { _id: false }
);

const notificationsSchema = new mongoose.Schema(
  {
    pushEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: false },
    weeklyDigest: { type: Boolean, default: true },
    newFollowers: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
  },
  { _id: false }
);

const appearanceSchema = new mongoose.Schema(
  {
    theme: { type: String, default: 'dark' },
    reduceMotion: { type: Boolean, default: true },
    largeText: { type: Boolean, default: false },
    highContrast: { type: Boolean, default: false },
  },
  { _id: false }
);

const privacySchema = new mongoose.Schema(
  {
    privateProfile: { type: Boolean, default: false },
    showActivityStatus: { type: Boolean, default: true },
    searchableByEmail: { type: Boolean, default: true },
    personalizedRecommendations: { type: Boolean, default: true },
    dataCollection: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    profile: { type: profileSchema, default: () => ({}) },
    settings: {
      notifications: { type: notificationsSchema, default: () => ({}) },
      appearance: { type: appearanceSchema, default: () => ({}) },
      privacy: { type: privacySchema, default: () => ({}) },
    },
    favoriteAuthors: { type: [String], default: [] },
    vaultSettings: {
      autoLockMinutes: { type: Number, default: 5 },
      biometricEnabled: { type: Boolean, default: false },
      stealthMode: { type: Boolean, default: false },
      decoyVaultEnabled: { type: Boolean, default: true },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: String(this._id),
    fullName: this.fullName,
    email: this.email,
    profile: this.profile,
    settings: this.settings,
    favoriteAuthors: this.favoriteAuthors || [],
    vaultSettings: this.vaultSettings || {},
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
