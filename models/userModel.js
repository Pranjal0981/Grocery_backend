const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Address Schema
const addressSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    }
});

const Address = mongoose.model('Address', addressSchema);

// User Schema
const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        minlength: [4, "Firstname should be at least 4 characters long"]
    },
    lastName: {
        type: String,
        minlength: [4, "Firstname should be at least 4 characters long"]
    },
    referralCode:{
        type:String,
        // required:true,
        unique:true,
    },
    phone: {
        type: String,
    },
    userType: {
        type: String,
        default: "customer"
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
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'],
    },
    PreferredStore: {
        type: String,
    },
    password: {
        type: String,
        minlength: [4, "Password should be at least 4 characters long"],
           },
    location: {
        type: String
    },
    address: [addressSchema], // Embedding address schema in user schema
    selectedAddressIndex: {
        type: Number,
        default: 0 // Default index of the selected address
    },
    lastLogin: {
        type: Date,
        default: null
    },
    blocked: {
        type: Boolean,
        default: false
    },
    resetPassword: {
        type: String,
        default: "0"
    }
}, { timestamps: true });

userSchema.pre("save", function () {
    if (!this.isModified("password")) {
        return;
    }
    let salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt)
});

userSchema.methods.comparePassword = function (password) {
    return bcrypt.compareSync(password, this.password)
}

userSchema.methods.getjwttoken = function () {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    })
}

const User = mongoose.model("User", userSchema);

module.exports = { User, Address };
