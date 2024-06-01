const mongoose = require('mongoose');

const contactUsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
    },
    message: {
        type: String,
        required: true
    },
    store:{
        type:String,
        required:true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ContactUs = mongoose.model('ContactUs', contactUsSchema);

module.exports = ContactUs;
