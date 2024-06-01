const mongoose = require('mongoose');

const wishlist = new mongoose.Schema({
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Wishlist = mongoose.model('Wishlist', wishlist);

module.exports = Wishlist;
