const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const superAdminSchema = new mongoose.Schema({
    userType: {
        type: String,
        enum: ['SuperAdmin'],
        default: "SuperAdmin"
    },
    otp: {
        type: Number,
        default: -1
    },
    isAuth: {
        type: Boolean,
        default: false
    },
    email: {
        type: String,
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    },
    password: {
        type: String,
        minlength: [8, "Password should be at least 8 characters long"],
    },
    lastLogin: {
        type: Date,
        default: null
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date
}, { timestamps: true });

superAdminSchema.pre("save", async function (next) {
    const count = await this.constructor.countDocuments();
    if (count >= 4) {
        const err = new Error('Maximum document limit reached for SuperAdmins.');
        return next(err);
    }
    if (!this.isModified("password")) {
        return next();
    }
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt)
    next();
});

superAdminSchema.methods.comparePassword = function (password) {
    return bcrypt.compareSync(password, this.password)
}

superAdminSchema.methods.getjwttoken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

superAdminSchema.methods.getResetPasswordToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // Token expires in 15 minutes

    return resetToken;
}

const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);
module.exports = SuperAdmin;
