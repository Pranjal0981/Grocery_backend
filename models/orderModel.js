const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, required: true },
    store:{type:String,required:true}
});

const orderSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Cancelled','Pending', 'Confirmed', 'Shipped', 'Delivered'],
        default: 'Pending'
    },
    products: [productSchema],
    totalGrandPrice: { type: Number, default: 0 },
        userId:{
        type: mongoose.Schema.Types.ObjectId,
         ref: 'User', required: true 
    },
    pdfUrl: {
        type: String,
    },
    reqCancellation: {
        type: String,
        enum: ['Yes', 'No'],
        default: 'No'
    },
    PaymentType: {
        type: String,
        required:true,
    },
    OrderId:{
        type:String,
        required:true
    }
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
