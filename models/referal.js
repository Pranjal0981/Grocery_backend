const mongoose = require('mongoose');
const {User} = require('./userModel'); // Adjust the path according to your project structure

const referralSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referredUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

referralSchema.methods.creditWallets = async function (newUser) {
    const referringUser = await User.findById(this.owner);
    if (!referringUser) {
        throw new Error('Referring user not found');
    }

    // Add 20 rupees to the new user's wallet
    newUser.wallet += 20;

    // Add 20 rupees to the referring user's wallet
    referringUser.wallet += 20;

    // Save both users
    await Promise.all([newUser.save(), referringUser.save()]);
};

module.exports = mongoose.model('Referral', referralSchema);
