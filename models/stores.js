const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const stores = new Schema({
    stores:{
        type:Array,
        
    }
});

const Stores = mongoose.model('Stores', stores);

module.exports = Stores;
