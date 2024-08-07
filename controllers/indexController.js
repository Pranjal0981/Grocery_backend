const { catchAsyncErrors } = require('../middlewares/catchAsyncError')
const { User, Address } = require('../models/userModel');
const crypto=require('crypto')
const nodemailer=require('nodemailer')
const Admin = require('../models/adminModel')
const { sendToken } = require('../utils/sendToken');
const bcrypt = require('bcryptjs')
const Wishlist = require('../models/wishlist')
const Product = require('../models/product')
const Cart = require('../models/cart')
const { sendmail } = require('../utils/nodemailer')
const mongoose = require('mongoose')
const ContactUs=require('../models/contact')
const ErrorHandler = require('../utils/ErrorHandler')
const Order = require('../models/orderModel')
const imagekitClient=require('../utils/imagekit').initimagekit()
const {paymentInitialisation} = require('./paymentController');
const {v4: uuidv4 } = require('uuid');
const Store=require('../models/StoreStock')
const axios=require('axios')
const jwt=require('jsonwebtoken')
const shortid=require('shortid')
const Referral=require('../models/referal')

const checkReferral = async (userId) => {
    try {
        // Query to find if the user is referred
        const referral = await Referral.findOne({ referredUsers: userId }).populate({
            path: 'owner',
            select: 'referralCode' // Only select the referralCode from the owner
        });

        if (!referral) {
            return null; // User is not referred
        }

        // User is referred, return the owner's referral code
        return {
            referralCode: referral.owner.referralCode,
            referredBy: referral.owner // Optionally, you can return the entire owner object if needed
        };
    } catch (error) {
        console.error('Error checking referral:', error);
        throw new Error('Error checking referral');
    }
};

exports.currentUser = catchAsyncErrors(async (req, res, next) => {
    try {
        // Check if token is available in the Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const token = authHeader.split(' ')[1];

        // Verify the token and extract user ID
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update user's authentication status and last login time
        user.isAuth = true;
        user.lastLogin = new Date();
        await user.save();

        // Check if the user is referred by any other user
        const referralData = await checkReferral(userId);

        // Prepare the response object
        const userData = {
            ...user.toObject(), // Convert user Mongoose document to plain JavaScript object
            referralCode: user.referralCode, // Include user's referral code if it exists
            referredByReferralCode: referralData ? referralData.referralCode : null, // Referral code of referring user
            referredBy: referralData && referralData.referredBy ? referralData.referredBy.toObject() : null // Details of referring user
            // Add more fields as needed
        };

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// exports.copyStore = catchAsyncErrors(async (req, res, next) => {
//     // const { sourceStoreName } = req.body; // Assuming you get the source store name from the request body
//     const destinationStoreName = "Gulmohar"; // Destination store is always "AwadhPuri"

//     try {
//         // Find all stock records of the products in the source store
//         const sourceStocks = await Store.find({ storeName: "Jhansi" });

//         if (!sourceStocks || sourceStocks.length === 0) {
//             return res.status(404).json({ success: false, message: `No stocks found in the source store: Katara Hills.` });
//         }

//         // Iterate through each product stock in the source store
//         for (const sourceStock of sourceStocks) {
//             // Find the stock record of the product in the destination store
//             const destinationStock = await Store.findOne({ storeName: destinationStoreName, productId: sourceStock.productId });

//             // If destination stock exists, update its quantity
//             if (destinationStock) {
//                 destinationStock.stock += sourceStock.stock; // Add the stock from the source store
//                 await destinationStock.save();
//             } else {
//                 // If destination stock doesn't exist, create a new stock record
//                 const newStock = new Store({
//                     productId: sourceStock.productId,
//                     storeName: destinationStoreName,
//                     stock: sourceStock.stock, // Copying stock quantity
//                 });
//                 await newStock.save();
//             }
//         }

//         res.status(200).json({ success: true, message: `All product stocks copied successfully from Jhansi to Rohit Nagar` });
//     } catch (error) {
//         console.error('Error copying product stocks:', error);
//         res.status(500).json({ success: false, message: 'Error copying product stocks.' });
//     }
// });
exports.signUp = catchAsyncErrors(async (req, res, next) => {
    try {
        const { email, password, referralCode } = req.body.formData;
        console.log('Request body:', req.body);

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User with this email already exists' });
        }

        let referringUser = null;
        let referral = null;

        if (referralCode) {
            referral = await Referral.findOne({ code: referralCode });
            console.log('Referral found:', referral);
            if (!referral) {
                return res.status(400).json({ success: false, message: 'Invalid referral code' });
            }
            referringUser = await User.findById(referral.owner);
            console.log('Referring user:', referringUser);
            if (!referringUser) {
                return res.status(400).json({ success: false, message: 'Referring user not found' });
            }
        }

        const newUser = new User({
            email,
            password,
            wallet: 0, // Initialize wallet balance
        });

        // Save the new user
        await newUser.save();

        if (referralCode && referringUser) {
            await referral.creditWallets(newUser);
            referral.referredUsers.push(newUser._id);
            await referral.save();
        }

        sendToken(newUser, 201, res);
    } catch (error) {
        console.error('Error registering newUser:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});




exports.login = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req.body);
        const { email, password } = req.body.formData;

        // Find the user by email
        const user = await User.findOne({ email });

        // If user not found, return 404
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user is blocked
        if (user.blocked) {
            return res.status(401).json({ message: 'Your account is blocked. Please contact support.' });
        }

        // Check if the password matches
        const isPasswordMatch = await user.comparePassword(password);

        // If password does not match, return 401
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If everything is correct, send token
        sendToken(user, 200, res);
    } catch (error) {
        console.error('Error in login controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

exports.logout = catchAsyncErrors(async (req, res, next) => {
    res.clearCookie("token")
    res.json({ message: "Successfully Signout" })
})

exports.updateUser = catchAsyncErrors(async (req, res, next) => {
    try {
        const { id } = req.params; // Assuming the user ID is passed as a URL parameter
        const { firstName, lastName, phone, email, password, confirmPassword, location, address } = req.body;

        // Construct the update object based on the fields provided
        const updateFields = {};
        if (firstName) updateFields.firstName = firstName;
        if (lastName) updateFields.lastName = lastName;
        if (phone) updateFields.phone = phone;
        if (email) updateFields.email = email;
        if (location) updateFields.location = location;
        if (address) updateFields.address = address;

        // Update password if provided and matches confirmPassword
        if (password && confirmPassword && password === confirmPassword) {
            const salt = bcrypt.genSaltSync(10);
            updateFields.password = bcrypt.hashSync(password, salt);
        } else if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Password and confirm password do not match' });
        }

        // Find and update the user using findOneAndUpdate
        const updatedUser = await User.findOneAndUpdate(
            { _id: id },
            { $set: updateFields },
            { new: true }
        );

        // Check if user exists
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        next(error);
    }
});

exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
    try {
        const userId = req.params.id;
        const deletedUser = await User.findByIdAndDelete(userId);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

exports.addToWishlist = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId } = req.body;
        const userId = req.params.userId;

        // Check if the user is of type "customer"
        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can add products to the wishlist' });
        }

        let wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new Wishlist({ user: userId, products: [] });
        }
        if (wishlist.products.includes(productId)) {
            return res.status(400).json({ success: false, message: 'Product already exists in wishlist' });
        }

        wishlist.products.push(productId);
        await wishlist.save();

        res.status(200).json({ success: true, message: 'Product added to wishlist successfully' });
    } catch (error) {
        next(error);
    }
});


exports.fetchWishlist = catchAsyncErrors(async (req, res, next) => {
    try {
        const userId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const wishlist = await Wishlist.findOne({ user: userId })
            .populate('products')
            .skip(skip) // Skip the specified number of documents
            .limit(limit); // Limit the number of documents to retrieve

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found for this user' });
        }
console.log(wishlist)
        res.status(200).json({ success: true, data: wishlist });
    } catch (error) {
        next(error);
    }
});

exports.deleteFromWishlist = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId } = req.params;
        const userId = req.params.userId;
        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found for this user' });
        }
        const updatedProducts = wishlist.products.filter(product => product.toString() !== productId);
        wishlist.products = updatedProducts;
        await wishlist.save();
        res.status(200).json({ success: true, message: 'Product removed from wishlist successfully' });
    } catch (error) {
        next(error);
    }
})

exports.fetchProducts = catchAsyncErrors(async (req, res, next) => {
    try {
        const products = await Product.find();
        res.status(200).json({ success: true, data: products });
    } catch (error) {
        next(error);
    }
});


exports.addToCart = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.id;  // Use authenticated user's ID
console.log(userId)
        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can add products to the cart' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, products: [] });
        }

        const totalPrice = quantity * product.sellingPrice;
        if (isNaN(totalPrice)) {
            return res.status(400).json({ success: false, message: 'Invalid total price' });
        }

        const existingProductIndex = cart.products.findIndex(item => item.productId.equals(productId));
        if (existingProductIndex !== -1) {
            const existingProduct = cart.products[existingProductIndex];
            existingProduct.quantity += quantity;
            existingProduct.totalPrice += totalPrice;
        } else {
            cart.products.push({ productId, quantity, totalPrice });
        }

        cart.totalGrandPrice = cart.products.reduce((total, item) => total + item.totalPrice, 0);
        await cart.save();

        res.status(200).json({ success: true, message: 'Product added to cart successfully', cart });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        next(error);
    }
});




exports.updateCart = catchAsyncErrors(async (req, res, next) => {
    try {
        const { userId, store, productIds } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can update the cart' });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        let unavailableProducts = [];
        let storeProducts = {};

        for (const productId of productIds) {
            const storeProduct = await Store.findOne({ productId, storeName: store });
            if (!storeProduct) {
                const product = await Product.findById(productId);
                unavailableProducts.push({ productId, name: product ? product.productName : 'Unknown Product' });
            } else {
                storeProducts[productId] = storeProduct;
            }
        }
        console.log(unavailableProducts)
        if (unavailableProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some products are not available in the selected store',
                unavailableProducts
            });
        }

        for (let i = 0; i < cart.products.length; i++) {
            const product = cart.products[i];
            if (productIds.includes(product.productId.toString())) {
                const storeProduct = storeProducts[product.productId.toString()];
                if (storeProduct) {
                    cart.products[i].store = store;
                    cart.products[i].stock = storeProduct.stock;
                }
            }
        }

        await cart.save();

        res.status(200).json({ success: true, message: 'Cart updated successfully', cart });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


exports.deleteFromCart = catchAsyncErrors(async (req, res, next) => {
    try {
        const { userId, productId } = req.params;
console.log(req.params)
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID or product ID' });
        }

        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can remove products from the cart' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for this user' });
        }

        const productIndex = cart.products.findIndex(product => product._id.toString() === productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in the cart' });
        }

        cart.products.splice(productIndex, 1);

        cart.totalGrandPrice = cart.products.reduce((total, product) => total + product.totalPrice, 0);

        await cart.save();

        res.status(200).json({ success: true, message: 'Product removed from cart successfully', data: cart });
    } catch (error) {
        console.error('Error removing product from cart:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.returnRequest = catchAsyncErrors(async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { reqCancellation: 'Yes' }, { new: true });

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({ success: true, message: 'Return request successfully updated', data: updatedOrder });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

exports.fetchCartProducts = catchAsyncErrors(async (req, res, next) => {
    try {
        const userId = req.params.userId;

        // Check if userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        // Find the cart for the given user and populate product details
        const cart = await Cart.findOne({ user: userId }).populate('products.productId');

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for this user' });
        }

        // Send the cart data in the response
        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error('Error fetching cart products:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

exports.userSendMail = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email }).exec()
    if (!user) {
        return next(
            new ErrorHandler("User Not Found with this email address", 404)
        )
    }
    const url1 = `${req.protocol}://${req.get("host")}/user/forget-link/${user._id}`
    const url = `https://rgsgrocery.com/forget-link/${user._id}`
    sendmail(req, url1, res, url, next)
    res.json({ user, url1 })
    user.resetPassword = "1"
    await user.save()
})

exports.userforgetlink = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.params.id).exec();
    console.log(req.body.password)
    if (!user) {
        return next(new ErrorHandler("User Not Found with this email address", 404));
    }

    if (user.resetPassword === "1") {
        user.resetPassword = "0";
        user.password = req.body.password;
    } else {
        return next(new ErrorHandler("Link Expired", 404));
    }

    await user.save();

    res.status(200).json({ message: "Password Updated Successfully" });
});

exports.userresetpassword = catchAsyncErrors(async (req, res, next) => {
    const user = await User.findById(req.id).exec()
    user.password = req.body.password
    await user.save()
    res.status(200).json({ message: "Password Updated Successfully" })

})

exports.addAddress = catchAsyncErrors(async (req, res, next) => {
    try {
        const userId = req.id; // Assuming you have user ID stored in req.id after authentication
        const formData = req.body.formData;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can add address' });
        }

        const addressData = {
            fullName: formData.fullName,
            addressLine1: formData.addressLine1,
            addressLine2: formData.addressLine2,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            phone: formData.phone
        };

        // Push the new address data to the user's address array
        user.address.push(addressData);
        await user.save();

        res.status(201).json({ success: true, message: 'Address added successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

exports.updateUser = catchAsyncErrors(async (req, res, next) => {
    try {
        const { id } = req.params; // Assuming the user ID is passed as a URL parameter
        const { firstName, lastName, phone, email } = req.body;
        console.log(req.body)
        // Construct the update object based on the fields provided
        const updateFields = {};
        if (firstName) updateFields.firstName = firstName;
        if (lastName) updateFields.lastName = lastName;
        if (phone) updateFields.phone = phone;
        if (email) updateFields.email = email;

        // Find and update the user using findOneAndUpdate
        const updatedUser = await User.findOneAndUpdate(
            { _id: id },
            { $set: updateFields },
            { new: true }
        );

        // Check if user exists
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        next(error);
    }
});

exports.deleteAddress = catchAsyncErrors(async (req, res) => {
    try {
        const userId = req.params.userId;
        const addressIndex = req.params.index;
        const user = await User.findById(userId);

        // Check if user exists
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if the addressIndex is valid
        if (addressIndex < 0 || addressIndex >= user.address.length) {
            return res.status(404).json({ success: false, message: 'Invalid address index' });
        }

        // Remove the address at the specified index
        user.address.splice(addressIndex, 1);

        // Save the user
        await user.save();

        // Send response
        return res.status(200).json({ success: true, message: 'Address deleted successfully', user });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


async function sendMailHandler(email, pdfUrl, paymentType, orderId, invoiceNumber) {
    console.log(pdfUrl);
    try {
        // Fetch the PDF as a buffer
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        const pdfBuffer = Buffer.from(response.data, 'binary');

        // Create transport
        const transport = nodemailer.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAIL_EMAIL,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        // Email options
        const mailOptions = {
            from: "RGS India Group <pranjalshukla245@gmail.com>",
            to: email,
            subject: "Order Invoice from RGS Grocery",
            html: `<!DOCTYPE html>
                <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body>
                        <div class="container">
                            <h1>RGS Grocery</h1>
                            <p>Please find attached your order invoice from RGS India Group.</p>
                            <p>Thank you for shopping with us,<br>Team RGS Grocery</p>
                        </div>
                    </body>
                </html>`,
            attachments: [
                {
                    filename: 'checkout_bill.pdf',
                    content: pdfBuffer, // Buffer containing the PDF data
                },
            ],
        };

        // Send mail
        await transport.sendMail(mailOptions);
        return true; // Email sent successfully
    } catch (error) {
        console.log(error);
        return false; // Failed to send email
    }
}

exports.userOrder = catchAsyncErrors(async (req, res) => {
    try {
        // Extract the userId from the request params
        const { userId } = req.params;

        // Ensure userId is provided
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        // Extract the checkOutCart, totalGrandPrice, and other details from the request body
        const { checkOutCart, totalGrandPrice, email, paymentType, orderId, invoiceNumber } = req.body;

        // Ensure checkOutCart, totalGrandPrice, email, and paymentType are provided
        if (!checkOutCart || !totalGrandPrice || !email || !paymentType) {
            return res.status(400).json({ success: false, message: 'Checkout cart, total grand price, email, and payment type are required' });
        }

        // Decode the double-encoded JSON string for checkOutCart
        let products;
        try {
            products = JSON.parse(JSON.parse(checkOutCart));
        } catch (error) {
            return res.status(400).json({ success: false, message: 'Invalid JSON format for checkout cart' });
        }

        // Validate products format (ensure it's an array of objects)
        if (!Array.isArray(products) || !products.every(item => typeof item === 'object' && item.productId && item.quantity && item.totalPrice && item.store)) {
            return res.status(400).json({ success: false, message: 'Invalid products format' });
        }

        // Create an array to store product details
        const productArr = products.map(item => {
            const { productId, quantity, totalPrice, store } = item;
            return { productId, quantity, totalPrice, store };
        });

        // Handle the PDF file upload to ImageKit (assuming imagekitClient is correctly configured)
        let pdfUrl = '';
        if (req.files && req.files.pdfFile) {
            const pdfFile = req.files.pdfFile;
            const result = await imagekitClient.upload({
                file: pdfFile.data,
                fileName: pdfFile.name,
                folder: "/orders"
            });
            pdfUrl = result.url;
        }

        // Create a new order document
        const order = new Order({
            products: productArr,
            userId: userId,
            totalGrandPrice,
            PaymentType: paymentType,
            pdfUrl,
            OrderId: orderId,
            InvoiceNumber: invoiceNumber
        });

        // Save the order document
        await order.save();

        // Deduct from user's wallet if paymentType is 'wallet'
        if (paymentType === 'Wallet Payment') {
            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Check if user has sufficient balance
            if (user.wallet < totalGrandPrice) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
            }

            // Deduct from wallet
            user.wallet -= totalGrandPrice;
            await user.save();
        }

        // Check if the user is referred by any other user
        const referral = await Referral.findOne({ referredUsers: userId });

        if (referral) {
            // Retrieve the owner of the referral code
            const owner = await User.findById(referral.owner);

            if (owner) {
                // Calculate incentive (1% of totalGrandPrice)
                const incentiveAmount = totalGrandPrice * 0.01;
                owner.wallet += incentiveAmount;
                await owner.save();
            }
        }

        // Send email with the PDF attachment
        const emailSent = await sendMailHandler(email, pdfUrl,paymentType,orderId,invoiceNumber);

        if (!emailSent) {
            return res.status(500).json({ success: false, message: 'Failed to send email' });
        }

        // Send success response
        res.status(200).json({ success: true, message: 'Order placed successfully', order });
    } catch (error) {
        console.error('Error in userOrder controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.updateProductQuantity = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId, quantity,userId} = req.body;
console.log(req.body)
        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can update products in the cart' });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for this user' });
        }

        const productIndex = cart.products.findIndex(item => item.productId.equals(productId));
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in the cart' });
        }

        const product = cart.products[productIndex];
        const productPrice = await Product.findById(product.productId).select('sellingPrice');

        if (!productPrice) {
            return res.status(404).json({ success: false, message: 'Product price not found' });
        }

        const totalPrice = quantity * productPrice.sellingPrice;
        if (isNaN(totalPrice)) {
            return res.status(400).json({ success: false, message: 'Invalid total price' });
        }

        product.quantity = quantity;
        product.totalPrice = totalPrice;

        // Calculate totalGrandPrice
        cart.totalGrandPrice = cart.products.reduce((total, item) => total + (item.totalPrice || 0), 0);
        await cart.save();

        res.status(200).json({ success: true, message: 'Product quantity updated successfully', cart });
    } catch (error) {
        console.log(error)
    }
})
    
exports.addToWallet = catchAsyncErrors(async (req, res, next) => {
    const {  amount } = req.body;
const {userId}=req.params
    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.wallet += amount;
        await user.save();

        res.status(200).json({ success: true, message: 'Wallet updated successfully', wallet: user.wallet });
    } catch (error) {
        console.error('Error updating wallet:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.fetchUserOrder = catchAsyncErrors(async (req, res, next) => {
    try {
        // Extract the userId from the request params
        const { userId } = req.params;

        // const token = req.headers.authorization.split(' ')[1];
        // if (!token) {
        //     return res.status(401).json({ success: false, message: 'User not authenticated' });
        // }

        // Fetch the user's order and populate the productId and userId fields
        const userOrder = await Order.find({ userId: userId })
            .populate('products.productId')
            .populate('userId');

        console.log(userOrder)
        res.status(200).json({ success: true, data: userOrder });
    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


exports.contactUs = catchAsyncErrors(async (req, res, next) => {
    try {
        const { name, email, message,store } = req.body;
        
        // Create a new contact us document using the ContactUs model
        const newContact = new ContactUs({
            name,
            email,
            message,
            store
        });

        await newContact.save();

        res.status(201).json({ success: true, message: 'Your message has been sent successfully!' });
    } catch (error) {
        console.error('Error in contactUs controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


exports.setPreferredStore = catchAsyncErrors(async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { selectedStore } = req.body;

        // Extract the token from the request headers
        // const token = req.headers.authorization.split(' ')[1];

        // // Verify the token
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // if (!decoded || decoded.id !== userId) {
        //     return res.status(401).json({ success: false, message: 'Unauthorized' });
        // }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.PreferredStore = selectedStore;
        await user.save();

        res.status(200).json({ success: true, message: 'Preferred store set successfully' });
    } catch (error) {
        next(error);
    }
});


exports.selectAddressIndex = catchAsyncErrors(async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const { addressIndex } = req.body.index; // Extract addressIndex from req.body.index
        console.log(req.body, req.params);

        // Extract the token from the request headers
        // const token = req.headers.authorization.split(' ')[1];
        // console.log(token);

        // // Verify the token
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // if (!decoded || decoded.id !== userId) {
        //     return res.status(401).json({ success: false, message: 'Unauthorized' });
        // }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Assuming you have an array of addresses in your user schema
        if (addressIndex < 0 || addressIndex >= user.address.length) {
            return res.status(400).json({ success: false, message: 'Invalid address index' });
        }

        user.selectedAddressIndex = addressIndex; // Assign the extracted addressIndex
        await user.save();

        res.status(200).json({ success: true, message: 'Address index set successfully' });
    } catch (error) {
        next(error);
    }
});






exports.clearCart = catchAsyncErrors(async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer')) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const token = authHeader.split(' ')[1];

        const userId = req.body.userId;

        // Assuming Cart is your Mongoose model
        await Cart.findOneAndUpdate(
            { user: userId },
            { $set: { products: [], totalGrandPrice: 0 } }, // Resetting the cart's products and total price
            { new: true }
        );

        // Send a success response
        res.status(200).json({
            success: true,
            message: 'Cart cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing cart:', error);
        // Send an error response
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});




// exports.doPayment = catchAsyncErrors(async (req, res, next) => {
//     try {
//         // Get necessary data from the request body
//         const { userId } = req.params;

//         // Find user by ID and await the result
//         const user = await User.findById(userId);

//         console.log(user);

//         const data = {
//             amount: parseFloat(req.body.amount).toFixed(2),
//             productinfo: req.body.products,
//             email: user.email,
//             name: `${user.firstName} ${user.lastName}`,
//             phone: user?.phone,
//             furl: "http://localhost:3000/response",
//             surl: "http://localhost:3000/response",
//             txnid: uuidv4()
//         };

//         console.log(data);
//         const config = {
//             key: process.env.EASEBUZZ_KEY,
//             env: process.env.EASEBUZZ_ENV, // or 'prod'
//             salt: process.env.EASEBUZZ_SALT,
//             enable_iframe: process.env.EASEBUZZ_IFRAME // or 1 based on your requirements
//         };

//         paymentInitialisation(data, config, res, (error, response) => {
//             console.log("=====",res)
//             if (error) {
//                 return res.status(500).json({ error: 'Payment initiation failed' });
//             } else {
//                 // console.log(data)
//                 const paymentLink = response; // Capture the payment URL
//                 // conosle.log(paymentLink)
//                 return res.status(200).json({ paymentLink });
//             }     
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({ error: 'An unexpected error occurred' });
//     }
// });


exports.generateReferralCode =catchAsyncErrors( async (req, res, next) => {
    try {
        const user = await User.findById(req.body.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the user already has a referral code
        if (user.referralCode) {
            return res.status(200).json({ referralCode: user.referralCode });
        }

        const prefix = "GROCERY";
        let referralCode;
        let isUnique = false;

        // Loop until a unique referral code is generated
        while (!isUnique) {
            const randomNumber = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit random number
            referralCode = `${prefix}${randomNumber}`;

            // Check if the generated referral code is already in use
            const existingReferral = await Referral.findOne({ code: referralCode });

            if (!existingReferral) {
                isUnique = true;
            }
        }

        // Save the referral code to the user document
        user.referralCode = referralCode;
        await user.save();

        // Create a new Referral document to track the referral code usage
        const newReferral = new Referral({
            code: referralCode,
            owner: req.body.userId
        });
        await newReferral.save();

        res.status(200).json({ referralCode });
    } catch (error) {
        next(error); // Pass any errors to the error handling middleware
    }
});
