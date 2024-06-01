const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true },
    store: { type: String }, // Make store field required
    stock: { type: Number } // Include stock field
});

const cartSchema = new mongoose.Schema({
    products: [productSchema],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalGrandPrice: { type: Number, default: 0 }
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
