const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/paymentModel');
const { catchAsyncErrors } = require('../middlewares/catchAsyncError');
const imagekit = require('../utils/imagekit').initimagekit();
const User = require('../models/userModel');
const nodemailer = require('nodemailer');
const axios = require('axios');

var instance = new Razorpay({
    key_id: process.env.RAZORPAY_API_KEY,
    key_secret: process.env.RAZORPAY_API_SECRET
});

exports.checkout = catchAsyncErrors(async (req, res) => {
    console.log(instance)
    try {
        const options = {
            amount: Number(req.body.amount * 100),
            currency: "INR",
        };

        // Create order asynchronously
        const order = await new Promise((resolve, reject) => {
            instance.orders.create(options, function (err, order) {
                if (err) {
                    reject(err);
                } else {
                    resolve(order);
                }
            });
        });
        console.log(order)

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error) {
        console.error("Error in checkout:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create order",
        });
    }
});

exports.paymentVerification = catchAsyncErrors(async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            await Payment.create({
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
            });

            res.send({
                success: true,
                message: "Payment verification successful",
                reference_id: razorpay_payment_id
            });
        } else {
            res.status(400).json({
                success: false,
                error: "Payment verification failed",
            });
        }
    } catch (error) {
        console.error("Error in payment verification:", error);
        res.status(500).json({
            success: false,
            error: "Payment verification failed",
        });
    }
});
