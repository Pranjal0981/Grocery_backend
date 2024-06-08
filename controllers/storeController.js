const { catchAsyncErrors } = require('../middlewares/catchAsyncError');
const Store = require('../models/storeManagerModel');
const Product =require('../models/product')
const { sendToken } = require('../utils/sendToken');
const bcrypt = require('bcryptjs');
const ErrorHandler = require('../utils/ErrorHandler');
const { sendmail } = require('../utils/nodemailer');
const StoreStock =require('../models/StoreStock')
const jwt=require('jsonwebtoken')
exports.storeRegister = catchAsyncErrors(async (req, res, next) => {
    try {
        // console.log(req.body)
        // const authorizedSources = process.env.AUTHORIZED_EMAIL.split(',');
        const { email } = req.body;
        // if (!authorizedSources.includes(email)) {
        //     return res.status(403).json({ success: false, message: 'Unauthorized registration' });
        // }
        console.log(req.body)
        const { password, store } = req.body;
        const existingmanager = await Store.findOne({ email });
        if (existingmanager) {
            return res.status(400).json({ success: false, message: 'Manager with this email already exists' });
        }
        const newManager = new Store({
            email,
            password,
            store: store
        });

        await newManager.save();
        sendToken(newManager, 201, res);
    } catch (error) {
        console.error('Error registering manager:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



exports.storeLogin = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req.body)
        const { email, password, store } = req.body;

        // Find the admin by email
        const storemanager = await Store.findOne({ email });

        // If admin not found, return 404
        if (!storemanager) {
            return res.status(404).json({ message: 'Store Manager not found' });
        }

        // Check if the requested store name matches the admin's store
        if (storemanager.store !== store) {
            return res.status(401).json({ message: 'Unauthorized access to store' });
        }

        // Check if the password matches
        const isPasswordMatch =  await bcrypt.compare(password, storemanager.password);

        // If password does not match, return 401
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If everything is correct, send token
        sendToken(storemanager, 200, res);
    } catch (error) {
        console.error('Error in loginMangager controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


exports.currentStoreManager = catchAsyncErrors(async (req, res, next) => {
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
console.log(userId)
        const user = await Store.findById(userId);
console.log(user)
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.isAuth = true;

        user.lastLogin = new Date();

        await user.save();

        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.logoutStoreManager = catchAsyncErrors(async (req, res, next) => {
    res.clearCookie("token")
    res.json({ message: "Successfully Signout" })

})


exports.storeSendMail=catchAsyncErrors(async(req,res,next)=>{
 
        const storemanager = await Store.findOne({ email: req.body.email }).exec()
    if (!storemanager) {
            return next(
                new ErrorHandler("StoreManager Not Found with this email address", 404)
            )
        }
        const url1 = `${req.protocol}://${req.get("host")}/admin/forget-link/${storemanager._id}`
    const url = `http://rgsgrocery.com/storemanager/forget-link/${storemanager._id}`
        sendmail(req, url1, res, url, next)
    res.json({ storemanager, url1 })
    storemanager.resetPassword = "1"
    await storemanager.save()
    
})


exports.storeForgetLink = catchAsyncErrors(async (req, res, next) => {
    console.log(req.body)
    const storemanager = await Store.findById(req.params.id).exec();
    console.log(req.body.password)
    if (!storemanager) {
        return next(new ErrorHandler("Store Manager Not Found with this email address", 404));
    }

    if (storemanager.resetPassword === "1") {
        storemanager.resetPassword = "0";
        storemanager.password = req.body.password;
    } else {
        return next(new ErrorHandler("Link Expired", 404));
    }

    await storemanager.save();

    res.status(200).json({ message: "Password Updated Successfully" });
});

exports.getAllProducts = catchAsyncErrors(async (req, res, next) => {
    try {
        const { store } = req.params;
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 100;
        let searchQuery = req.query.search || '';

        let skip = (page - 1) * limit;

        // Build search conditions for product fields
        const productConditions = searchQuery ? {
            $or: [
                { productName: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } }
            ]
        } : {};

        // Get the IDs of the products that match the search conditions
        const matchingProducts = await Product.find(productConditions).select('_id');
        const matchingProductIds = matchingProducts.map(product => product._id);

        // Combine store name and matching product IDs to form search conditions for StoreStock
        const searchConditions = {
            storeName: store,
            productId: { $in: matchingProductIds }
        };

        const totalProducts = await StoreStock.countDocuments(searchConditions);
        const totalPages = Math.ceil(totalProducts / limit);

        const storeStocks = await StoreStock.find(searchConditions)
            .populate('productId')
            .skip(skip)
            .limit(limit);

        const products = storeStocks.map(stock => ({
            productId: stock.productId._id,
            productName: stock.productId.productName,
            description: stock.productId.description,
            category: stock.productId.category,
            MRP: stock.productId.MRP,
            size: stock.productId.size,
            sellingPrice: stock.productId.sellingPrice,
            productCode: stock.productId.productCode,
            image: stock.productId.image,
            stock: stock.stock,
        }));
console.log(products)
        res.status(200).json({
            success: true,
            page: page,
            limit: limit,
            totalPages: totalPages,
            totalProducts: totalProducts,
            products: products,
        });
    } catch (error) {
        next(error);
    }
});

