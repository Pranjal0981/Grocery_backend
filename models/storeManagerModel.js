const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const storeSchema = new mongoose.Schema({
    userType: {
        type: String,
        enum: ['Storemanager'],
        default: "Storemanager"
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
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    },
    password: {
        type: String,
        minlength: [4, "Password should be at least 4 characters long"],
    },
    lastLogin: {
        type: Date,
        default: null
    },
    store: {
        type: String,
        required: true,
        unique: true,
    }
}, { timestamps: true });

storeSchema.pre("save", function () {
    if (!this.isModified("password")) {
        return;
    }
    let salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt)
});

storeSchema.methods.comparePassword = function (password) {
    return bcrypt.compareSync(password, this.password)
}

storeSchema.methods.getjwttoken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

storeSchema.pre('save', async function (next) {
    const count = await this.constructor.countDocuments();
    if (count >= 5) {
        const err = new Error('Maximum document limit reached.');
        return next(err);
    }
    next();
});


const Storemanager = mongoose.model("Storemanager", storeSchema);
module.exports = Storemanager;
