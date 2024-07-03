const jwt = require('jsonwebtoken');
const ErrorHandler = require('../utils/ErrorHandler');
const { catchAsyncErrors } = require('./catchAsyncError');

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
    const authHeader = req.headers.authorization;
// console.log(authHeader)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new ErrorHandler("Login first to access this resource", 401));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.id = decoded.id;
        // console.log("Authenticated user ID:", req.id);
        next();
    } catch (error) {
        return next(new ErrorHandler("Invalid token. Please log in again.", 401));
    }
});
