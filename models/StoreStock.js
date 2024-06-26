const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const storeStockSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', index: true }, // Reference to Product schema with an index
    storeName: String,
    stock: {
        type:Number,
        default:0
    },
});

const StoreStock = mongoose.model('StoreStock', storeStockSchema);

module.exports = StoreStock;
