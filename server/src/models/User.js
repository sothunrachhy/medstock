import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 50 },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    // brute-force protection (limits come from Settings → Auth)
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true },
);

userSchema.methods.isLocked = function isLocked() {
  return !!this.lockedUntil && this.lockedUntil > new Date();
};

// Length rules are checked by the routes with assertPasswordPolicy (configurable).
userSchema.methods.setPassword = async function setPassword(password) {
  if (!password) {
    const err = new Error('Password is required');
    err.status = 400;
    throw err;
  }
  this.passwordHash = await bcrypt.hash(String(password), 10);
};

userSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(String(password || ''), this.passwordHash || '');
};

userSchema.methods.toPublic = function toPublic() {
  const r = this.role;
  const role =
    r && r._id
      ? {
          id: r.id,
          name: r.name,
          isSystem: r.isSystem,
          permissions: (r.permissions || []).map((p) => ({ module: p.module, actions: p.actions })),
        }
      : r;
  return {
    id: this.id,
    username: this.username,
    fullName: this.fullName,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    lockedUntil: this.isLocked() ? this.lockedUntil : null,
    createdAt: this.createdAt,
    role,
  };
};

export default mongoose.model('User', userSchema);
