const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
    userType: {
        type: String,
        enum: ['Admin'],
        default: "Admin"
    },
    otp: {
        type: Number,
        default: -1
    },
    isAuth: {
        type: Boolean,
        default: false
    },
    resetPassword: {
        type: String,
        default: "0"
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    },
    password: {
        type: String,
        required: true,
        minlength: [4, "Password should be at least 4 characters long"],
    },
    lastLogin: {
        type: Date,
        default: null
    },
    permissions: {
        canAddProducts:{
            type:Boolean,
            default:false,
        },
        canDeleteProducts: {
            type: Boolean,
            default: false,
        },
        canUpdateProducts: {
            type: Boolean,
            default: false,
        },
        canManageStores: {
            type: Boolean,
            default: false,
        },
        canViewOrders: {
            type: Boolean,
            default: false,
        },
        canUpdateOrders: {
            type: Boolean,
            default: false,
        },
        canDeleteOrders: {
            type: Boolean,
            default: false,
        },
    },
}, { timestamps: true });

// Password hashing before saving
adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Check if admin count exceeds limit
adminSchema.pre('save', async function (next) {
    const count = await this.constructor.countDocuments();
    if (count >= 5) {
        const err = new Error('Maximum document limit reached.');
        return next(err);
    }
    next();
});

// Password comparison method
adminSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

// JWT token generation
adminSchema.methods.getjwttoken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
}

const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
