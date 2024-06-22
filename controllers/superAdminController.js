const { catchAsyncErrors } = require('../middlewares/catchAsyncError')
const SuperAdmin = require('../models/superAdminModel')
const { sendToken } = require('../utils/sendToken');
const { sendmail } = require('../utils/nodemailer')
const bcrypt = require('bcryptjs')
const imagekit = require('../utils/imagekit').initimagekit()
const Product = require('../models/product')
const { v4: uuidv4 } = require('uuid');
const {User} = require('../models/userModel')
const Order = require('../models/orderModel')
const Contact=require('../models/contact')
const crypto = require('crypto');
const jwt=require('jsonwebtoken')
const ErrorHandler=require("../utils/ErrorHandler")
exports.registerSuperAdmin = catchAsyncErrors(async (req, res, next) => {
    try {
        // console.log(req.body)
        // const authorizedSources = process.env.AUTHORIZED_EMAIL.split(',');
        const { email } = req.body;
        // if (!authorizedSources.includes(email)) {
        //     return res.status(403).json({ success: false, message: 'Unauthorized registration' });
        // }
        console.log(req.body)
        const { password, store } = req.body;
        const existingSuperAdmin = await SuperAdmin.findOne({ email });
        if (existingSuperAdmin) {
            return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
        }
        const superAdmin = new SuperAdmin({
            email,
            password,
        });

        await superAdmin.save();
        sendToken(superAdmin, 201, res);
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.loginSuperAdmin = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req.body)
        const { email, password } = req.body;

        const superadmin = await SuperAdmin.findOne({ email });
        if (!superadmin) {
            return res.status(404).json({ message: 'superadmin not found' });
        }



        // Check if the password matches
        const isPasswordMatch = await bcrypt.compare(password, superadmin.password);

        // If password does not match, return 401
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If everything is correct, send token
        sendToken(superadmin, 200, res);
    } catch (error) {
        console.error('Error in loginAdmin controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


exports.currentSuperAdmin = catchAsyncErrors(async (req, res, next) => {
    try {
        // Check if token is available in the Authorization header
        const authHeader = req.headers.authorization;
console.log("====",authHeader)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const token = authHeader.split(' ')[1];

        // Verify the token and extract user ID
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        const superAdmin = await SuperAdmin.findById(userId).exec();

        if (!superAdmin) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        superAdmin.isAuth = true;
        superAdmin.lastLogin = new Date();

        await superAdmin.save();

        res.json({ success: true, superAdmin });
    } catch (error) {
        console.error('Error fetching current admin:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.logoutSuperAdmin = catchAsyncErrors(async (req, res, next) => {
    res.clearCookie("token")
    res.json({ message: "Successfully Signout" })
})

exports.fetchAllUsers = catchAsyncErrors(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1 if no page query parameter is provided
        const limit = 20;
        const skip = (page - 1) * limit;

        // Fetch users with pagination
        const users = await User.find().skip(skip).limit(limit);

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No users found'
            });
        }

        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(users.length / limit),
            users: users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

exports.blockMembers = catchAsyncErrors(async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
console.log("====",authHeader)
        const memberId = req.params.userId; // Assuming memberId is passed as a parameter in the request
        const updatedUser = await User.findByIdAndUpdate(memberId, { blocked: true }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({ success: true, message: 'User blocked successfully', user: updatedUser });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
});

exports.unblockMembers = catchAsyncErrors(async (req, res, next) => {
    try {
        const memberId = req.params.userId; // Assuming memberId is passed as a parameter in the request
        const updatedUser = await User.findByIdAndUpdate(memberId, { blocked: false }, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({ success: true, message: 'User blocked successfully', user: updatedUser });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
});

exports.deleteUserBySuperAdmin = catchAsyncErrors(async (req, res, next) => {
    const userId = req.params.userId;
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    const users = await User.find();
    res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        users: users // Include the updated list of users in the response
    });
});

exports.fetchLastDayActiveUsers = catchAsyncErrors(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to page 1 if no page query parameter is provided
        const limit = 15; // Limit the number of users per page
        const skip = (page - 1) * limit;
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1); // Set the date to 24 hours ago
        const activeUsers = await User.find({ lastLogin: { $gte: oneDayAgo } }).skip(skip).limit(limit);
        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(activeUsers.length / limit),
            activeUsers: activeUsers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

exports.fetchInactiveUser = catchAsyncErrors(async (req, res, next) => {
    try {
        // Calculate the timestamp 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const inactiveUsers = await User.find({ lastLogin: { $lt: sevenDaysAgo } });

        res.status(200).json({
            success: true,
            inactiveUsers: inactiveUsers
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
});

exports.fetchInfoForDashboard = catchAsyncErrors(async (req, res, next) => {
    try {
        // Calculate total members
        const totalMembers = await User.countDocuments().maxTimeMS(20000);

        // Calculate total blocked members
        const totalBlockedMembers = await User.countDocuments({ blocked: true }).maxTimeMS(20000);

        // Calculate active users in the last hour
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        const activeUsersByHour = await User.find({ lastLogin: { $gte: oneHourAgo } }).maxTimeMS(20000);

        // Calculate inactive users in the last 7 days
        const oneDayAgo = new Date();
        const sevenDaysAgo = new Date(oneDayAgo);
        sevenDaysAgo.setDate(oneDayAgo.getDate() - 7);
        const inactiveUsersIn7Days = await User.countDocuments({ lastLogin: { $lt: sevenDaysAgo } }).maxTimeMS(20000);

        // Calculate total profit
        const totalProfit = await Order.aggregate([
            { $match: { reqCancellation: { $ne: "Yes" } } },
            { $unwind: "$products" },
            {
                $lookup: {
                    from: "products",
                    localField: "products.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    profit: {
                        $multiply: [
                            { $subtract: ["$productDetails.sellingPrice", "$productDetails.purchasePrice"] },
                            "$products.quantity"
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalProfit: { $sum: "$profit" }
                }
            }
        ]).option({ maxTimeMS: 20000 });

        // Calculate total sales excluding cancelled orders
        const totalSales = await Order.aggregate([
            { $match: { reqCancellation: { $ne: "Yes" } } },
            { $project: { productCount: { $size: "$products" } } },
            { $group: { _id: null, totalProducts: { $sum: "$productCount" } } }
        ]).option({ maxTimeMS: 20000 });

        // Calculate sales by store
        const salesByStore = await Order.aggregate([
            { $unwind: "$products" }, // Unwind the products array
            {
                $group: {
                    _id: "$products.store",
                    totalProducts: { $sum: "$products.quantity" } // Sum the quantity for each store
                }
            }
        ]).option({ maxTimeMS: 20000 });

        // Calculate total pending orders count
        const pendingOrdersCount = await Order.countDocuments({ status: 'Pending' }).maxTimeMS(20000);

        // Respond with the calculated data
        res.status(200).json({
            success: true,
            data: {
                totalMembers,
                totalBlockedMembers,
                activeUsersByHour: activeUsersByHour.length,
                inactiveUsersIn7Days,
                totalProfit: totalProfit.length > 0 ? totalProfit[0].totalProfit : 0,
                pendingOrdersCount,
                totalSales: totalSales.length > 0 ? totalSales[0].totalProducts : 0,
                salesByStore
            }
        });
    } catch (error) {
        // Handle errors
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


exports.searchUser = catchAsyncErrors(async (req, res, next) => {
    try {
        const { query, page = 1, limit = 10 } = req.query;

        // Build a regular expression to perform a case-insensitive search
        const searchQuery = query ? {
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        } : {};

        // Calculate pagination details
        const skip = (page - 1) * limit;

        // Find users matching the search query with pagination
        const users = await User.find(searchQuery)
            .skip(skip)
            .limit(Number(limit));

        const total = await User.countDocuments(searchQuery);

        res.status(200).json({
            success: true,
            total,
            count: users.length,
            users
        });
    } catch (error) {
        next(error);
    }
});

exports.superAdminSendMail = catchAsyncErrors(async (req, res, next) => {
    const superAdmin = await SuperAdmin.findOne({ email: req.body.email }).exec();
    if (!superAdmin) {
        return next(new ErrorHandler("SuperAdmin Not Found with this email address", 404));
    }

    const resetToken = superAdmin.getResetPasswordToken();
    await superAdmin.save();

    const url1 = `${req.protocol}://${req.get("host")}/superadmin/forget-link/${resetToken}`;
    const url = `https://rgsgrocery.com/superadmin/forget-link/${resetToken}`;

    await sendmail(req, url1, res, url, next);

    res.json({ message: "Password reset link sent successfully", url1 });
});

exports.superAdminForgetLink = catchAsyncErrors(async (req, res, next) => {
    const { token } = req.params;
    // Check if the token is defined
    if (!token) {
        return next(new ErrorHandler("Token is required", 400));
    }

    // Debug log to ensure token is correct
    console.log("Token received:", token);

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await SuperAdmin.findOne({
        resetPasswordToken: resetTokenHash,
        resetPasswordExpire: { $gt: Date.now() }
    }).exec();

    // Check if user is found
    if (!user) {
        return next(new ErrorHandler("Invalid or expired password reset token", 400));
    }

    // Check if password is provided in the request body
    if (!req.body.password) {
        return next(new ErrorHandler("Password is required", 400));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: "Password Updated Successfully" });
});

exports.getUserQuery = catchAsyncErrors(async (req, res, next) => {
    try {
        // Fetch all user queries from the database
        const userQueries = await Contact.find();
        res.status(200).json({
            success: true,
            data: userQueries
        });
        console.log(userQueries)
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching user queries',
            error: error.message
        });
    }
});