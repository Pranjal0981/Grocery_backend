const { catchAsyncErrors } = require('../middlewares/catchAsyncError')
const { User, Address } = require('../models/userModel');
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
exports.currentUser = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req);

        // Retrieve user ID from the request object (set by the isAuthenticated middleware)
        const userId = req.id;

        // Find the user in the database based on the ID
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Set isAuth property if needed
        user.isAuth = true;

        // Update the last login time to the current time
        user.lastLogin = new Date();

        // Save the user document with the updated lastLogin time
        await user.save();

        // Send user data in the response
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


exports.signUp = catchAsyncErrors(async (req, res, next) => {
    try {
        // console.log(req.body)
        // const authorizedSources = process.env.AUTHORIZED_EMAIL.split(',');
        const { email } = req.body.formData;
        // if (!authorizedSources.includes(email)) {
        //     return res.status(403).json({ success: false, message: 'Unauthorized registration' });
        // }
        console.log(req.body)
        const { password } = req.body.formData;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
        }
        const newUser = new User({
            email,
            password,
            
        });

        await newUser.save();
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

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
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
        const userId = req.params.userId;

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
        const userId = req.params.userId;
        const productId = req.params.productId;
        const user = await User.findById(userId);
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can add products to the cart' });
        }
        // Find the cart for the user
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for this user' });
        }

        // Find the index of the product in the cart's products array
        const productIndex = cart.products.findIndex(product => product._id.toString() === productId);

        // Check if the product exists in the cart
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in the cart' });
        }

        // Remove the product from the cart's products array
        cart.products.splice(productIndex, 1);

        // Recalculate the totalGrandPrice
        cart.totalGrandPrice = cart.products.reduce((total, product) => total + product.totalPrice, 0);

        // Save the updated cart
        await cart.save();

        res.status(200).json({ success: true, message: 'Product removed from cart successfully', data: cart });
    } catch (error) {
        next(error);
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
        const cart = await Cart.findOne({ user: userId }).populate('products.productId');

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found for this user' });
        }

        res.status(200).json({ success: true, cart });
    } catch (error) {
        next(error);
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
        const userId = req.id; // Assuming you have user ID stored in req.user after authentication
        const formData = req.body.formData;
        const user = await User.findById(userId)
        if (!user || user.userType !== 'customer') {
            return res.status(403).json({ success: false, message: 'Only customers can remove address' });
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


        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

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


exports.deleteAddress =catchAsyncErrors( async (req, res) => {
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

async function sendMailHandler(email, pdfUrl) {
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

exports.userOrder = catchAsyncErrors(async (req, res, next) => {
    try {
        // Extract the userId from the request params
        const { userId } = req.params;

        // Ensure userId is provided
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        // Extract the checkOutCart, totalGrandPrice, and other details from the request body
        const { checkOutCart, totalGrandPrice, email, paymentType, orderId, invoiceNumber } = req.body;
        console.log(req.body);

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

        console.log(products);

        // Validate products format (ensure it's an array of objects)
        if (!Array.isArray(products) || !products.every(item => typeof item === 'object' && item.productId && item.quantity && item.totalPrice && item.store)) {
            return res.status(400).json({ success: false, message: 'Invalid products format' });
        }

        // Create an array to store product details
        const productArr = products.map(item => {
            const { productId, quantity, totalPrice, store } = item;
            return { productId, quantity, totalPrice, store };
        });

        console.log(req.files);

        // Handle the PDF file upload to ImageKit
        let pdfUrl = '';
        if (req.files && req.files.pdfFile) {
            const pdfFile = req.files.pdfFile;
            const result = await imagekitClient.upload({
                file: pdfFile.data, // Buffer or base64
                fileName: pdfFile.name,
                folder: "/orders"
            });
            pdfUrl = result.url;
        }

        // Create a new order document
        const order = new Order({
            products: productArr, // Set the products array
            userId: userId, // Set the user reference directly from req.params
            totalGrandPrice, // Set the totalGrandPrice
            PaymentType: paymentType, // Set the payment type
            pdfUrl ,// Set the PDF URL
            OrderId: orderId,
            InvoiceNumber: invoiceNumber
        });

        // Save the order document
        await order.save();

        const emailSent = await sendMailHandler(email, pdfUrl); // Send the email with the PDF attachment

        if (!emailSent) {
            return res.status(500).json({ success: false, message: 'Failed to send email' });
        }

        // Send success response
        res.status(200).json({ success: true, message: 'Order placed successfully', order });
    } catch (error) {
        // Handle errors
        console.error('Error in userOrder controller:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.updateProductQuantity = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId, quantity,userId} = req.body;

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
    


exports.fetchUserOrder = catchAsyncErrors(async (req, res, next) => {
    try {
        // Extract the userId from the request params
        const { userId } = req.params;

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
    console.log(req.body)
    const { userId } = req.params;
    const { selectedStore } = req.body;
    const user = await User.findById(userId);
console.log(user)
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.PreferredStore = selectedStore;
    await user.save();

    res.status(200).json({ success: true, message: 'Preferred store set successfully' });
});

exports.setAddressIndex = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { addressIndex } = req.body;

        // Validate addressIndex
        if (!Number.isInteger(addressIndex) || addressIndex < 0) {
            return res.status(400).json({ success: false, message: 'Invalid address index' });
        }

        const user = await User.findById(userId);

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (addressIndex >= user.address.length) {
            return res.status(400).json({ success: false, message: 'Invalid address index' });
        }

        user.selectedAddressIndex = addressIndex;
        await user.save();

        res.status(200).json({ success: true, message: 'Address index updated successfully' ,user});
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.clearCart = catchAsyncErrors(async (req, res, next) => {
    try {
        // Assuming Cart is your Mongoose model
        await Cart.findOneAndUpdate(
            { user: req.body.userId },
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
