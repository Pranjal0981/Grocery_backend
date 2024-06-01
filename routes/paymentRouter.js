const express=require('express')
const {
    checkout,
    paymentVerification,
} = require('../controllers/paymentController');
const { isAuthenticated } = require('../middlewares/auth');

const router = express.Router();

router.post("/checkout",isAuthenticated,checkout);

router.post("/paymentverification", isAuthenticated,paymentVerification);

module.exports=router