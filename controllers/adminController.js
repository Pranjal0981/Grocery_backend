const { catchAsyncErrors } = require('../middlewares/catchAsyncError')
const Admin=require('../models/adminModel')
const { sendToken } = require('../utils/sendToken');
const bcrypt = require('bcryptjs')
const ErrorHandler = require('../utils/ErrorHandler')
const imagekit=require('../utils/imagekit').initimagekit()
const Product=require('../models/product')
const { v4: uuidv4 } = require('uuid');
const {sendmail} =require('../utils/nodemailer')
const User=require('../models/userModel');
const Order = require('../models/orderModel');
const Store=require('../models/StoreStock')
const jwt = require('jsonwebtoken');

exports.registerAdmin = catchAsyncErrors(async (req, res, next) => {
    try {
        // console.log(req.body)
        // const authorizedSources = process.env.AUTHORIZED_EMAIL.split(',');
        const { email } = req.body;
        // if (!authorizedSources.includes(email)) {
        //     return res.status(403).json({ success: false, message: 'Unauthorized registration' });
        // }
        console.log(req.body)
        const { password } = req.body;
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
        }
        const newAdmin = new Admin({
            email,
            password,
        });

        await newAdmin.save();  
        sendToken(newAdmin, 201, res);
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.loginAdmin = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req.body);
        const { email, password } = req.body;

        // Find the admin by email
        const admin = await Admin.findOne({ email });

        // If admin not found, return 404
        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        console.log(admin.password);

        // Check if the password matches
        const isPasswordMatch = await bcrypt.compare(password, admin.password);

        // If password does not match, return 401
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // If everything is correct, send token
        sendToken(admin, 200, res);
    } catch (error) {
        console.error('Error in loginAdmin controller:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

exports.currentAdmin = catchAsyncErrors(async (req, res, next) => {
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

        const admin = await Admin.findById(userId).exec();

        if (!admin) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        admin.isAuth = true;
        admin.lastLogin = new Date();

        await admin.save();

        res.json({ success: true, admin });
    } catch (error) {
        console.error('Error fetching current admin:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

exports.logoutAdmin = catchAsyncErrors(async (req, res, next) => {
    res.clearCookie("token")
    res.json({ message: "Successfully Signout" })

})

exports.uploadProducts = catchAsyncErrors(async (req, res, next) => {
    try {
        const adminId = req.id; // Assuming the admin ID is in req.user

        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        // Check if the admin has the required permissions
        if (!admin.permissions.canUpdateProducts || !admin.permissions.canManageStores ||!admin.permissions.canAddProducts) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const {
            productName,
            purchasePrice,
            description,
            sellingPrice,
            category,
            brand,
            gst,
            cgst,
            productCode,
            MRP,
            size,
            ...stores
        } = req.body;

        const imageFiles = req.files;
        if (!imageFiles || !imageFiles.image) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const { data, name } = imageFiles.image;
        const uniqueFileName = `${Date.now()}_${uuidv4()}_${name}`;
        const { fileId, url } = await imagekit.upload({
            file: data,
            fileName: uniqueFileName,
            folder: '/groceryproducts'
        });

        const product = new Product({
            productName,
            description,
            sellingPrice,
            purchasePrice,
            MRP,
            size,
            category,
            brand,
            gst,
            cgst,
            productCode,
            image: {
                url,
                fieldId: fileId
            }
        });

        await product.save();
        const processedStores = new Set();
        const storeEntries = Object.entries(stores);
        if (storeEntries.length > 0) {
            for (const [key, value] of storeEntries) {
                const match = key.match(/^stores\[(\d+)\]\[(store|stock)\]$/);
                if (match) {
                    const index = match[1];
                    const storeName = stores[`stores[${index}][store]`];
                    const stock = stores[`stores[${index}][stock]`];

                    if (!processedStores.has(storeName)) {
                        const existingStore = await Store.findOne({ productId: product._id, storeName });
                        if (!existingStore) {
                            const newStore = new Store({
                                productId: product._id,
                                storeName,
                                stock
                            });
                            await newStore.save();
                        }
                        processedStores.add(storeName);
                    }
                }
            }
        }

        res.status(201).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
});

exports.deleteProduct = catchAsyncErrors(async (req, res, next) => {
    try {
        const productId = req.params.productId;
        let store = req.params.store;

        // Convert store name to case-insensitive regular expression
        store = new RegExp(store, 'i');

        // Find and delete the product from the specified store in the StoreStock schema
        const productInStock = await Store.findOneAndDelete({ productId, storeName: store });

        if (!productInStock) {
            return res.status(404).json({ success: false, message: 'Product not found in the specified store' });
        }

        // If the product has an image, delete it from ImageKit
        if (productInStock.productId.image && productInStock.productId.image.fieldId) {
            await imagekit.deleteFile(productInStock.productId.image.fieldId);
        }

        // Check if the product is associated with any other stores
        const otherStores = await Store.findOne({ productId });

        // If the product is not associated with any other stores, remove it from the Product schema
        if (!otherStores) {
            await Product.findByIdAndDelete(productId);
        }

        // Send success response
        res.status(200).json({ success: true, message: 'Product deleted successfully from the specified store' });
    } catch (error) {
        next(error);
    }
});


// exports.copyAllProductStocksFromAnotherStore = catchAsyncErrors(async (req, res, next) => {
//     const { sourceStoreName } = req.body; // Assuming you get the source store name from the request body
//     const destinationStoreName = "AwadhPuri"; // Destination store is always "AwadhPuri"

//     try {
//         // Find all stock records of the products in the source store
//         const sourceStocks = await StoreStock.find({ storeName: sourceStoreName });

//         if (!sourceStocks || sourceStocks.length === 0) {
//             return res.status(404).json({ success: false, message: `No stocks found in the source store: ${sourceStoreName}.` });
//         }

//         // Iterate through each product stock in the source store
//         for (const sourceStock of sourceStocks) {
//             // Find the stock record of the product in the destination store
//             const destinationStock = await StoreStock.findOne({ storeName: destinationStoreName, productId: sourceStock.productId });

//             // If destination stock exists, update its quantity
//             if (destinationStock) {
//                 destinationStock.stock += sourceStock.stock; // Add the stock from the source store
//                 await destinationStock.save();
//             } else {
//                 // If destination stock doesn't exist, create a new stock record
//                 const newStock = new StoreStock({
//                     productId: sourceStock.productId,
//                     storeName: destinationStoreName,
//                     stock: sourceStock.stock, // Copying stock quantity
//                 });
//                 await newStock.save();
//             }
//         }

//         res.status(200).json({ success: true, message: `All product stocks copied successfully from ${sourceStoreName} to ${destinationStoreName}.` });
//     } catch (error) {
//         console.error('Error copying product stocks:', error);
//         res.status(500).json({ success: false, message: 'Error copying product stocks.' });
//     }
// });
exports.fetchOrders = catchAsyncErrors(async (req, res, next) => {
    try {
        const { store } = req.params;
        console.log(`Store: ${store}`);
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let orders;
        let totalCount;

        if (store) {
            // Find orders that have products belonging to the given store
            orders = await Order.find({ 'products.store': store })
                .populate({
                    path: 'products.productId',
                    select: 'productName description MRP category brand purchasePrice sellingPrice image gst cgst productCode size'
                })
                .populate('userId')
                .sort({ createdAt: -1 }) // Sort orders by createdAt field in descending order
             
            console.log(`Orders: ${orders.length}`);

            // Count total number of orders for pagination
            totalCount = await Order.countDocuments({ 'products.store': store });
        } else {
            // Fetch all orders if store is not provided
            orders = await Order.find({})
                .populate({
                    path: 'products.productId',
                    select: 'productName description MRP category brand purchasePrice sellingPrice image gst cgst productCode size'
                })
                .populate('userId')
                .sort({ createdAt: -1 }) // Sort orders by createdAt field in descending order
                .skip(skip)
                .limit(limit);

            // Count total number of orders for pagination
            totalCount = await Order.countDocuments({});
        }

        // Calculate total number of pages
        const totalPages = Math.ceil(totalCount / limit);
        console.log(totalPages)
        res.status(200).json({ success: true, data: orders, totalPages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});



exports.fetchProductStockByStore = catchAsyncErrors(async (req, res, next) => {
    try {
        let storeName = req.params.storeName;
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const { search } = req.query;

        let productQuery = {};
        let storeQuery = {};

        if (storeName) {
            storeName = new RegExp(storeName, 'i');
            storeQuery.storeName = storeName;
        }

        if (search) {
            productQuery = {
                $or: [
                    { productName: { $regex: search, $options: 'i' } },
                    { category: { $regex: search, $options: 'i' } },
                    { productCode: { $regex: search, $options: 'i' } } // Add productCode to the search criteria

                ]
            };
        }

        // Find store stocks matching the storeName
        const storeStocks = await Store.find(storeQuery);
        const productIds = storeStocks.map(stock => stock.productId);

        productQuery._id = { $in: productIds };

        const totalProducts = await Product.countDocuments(productQuery);
        const skip = (page - 1) * limit;
        const products = await Product.find(productQuery)
            .skip(skip)
            .limit(limit);

        const paginatedStoreStocks = await Store.find({
            ...storeQuery,
            productId: { $in: products.map(product => product._id) }
        }).populate('productId');
console.log(paginatedStoreStocks)
        res.status(200).json({
            success: true,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            count: products.length,
            products: paginatedStoreStocks
        });
    } catch (error) {
        next(error);
    }
});


exports.fetchAllProducts = catchAsyncErrors(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const searchQuery = req.query.q || '';
    const searchType = req.query.type || 'brand'; // Default search type is 'brand'

    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    try {
        let searchConditions;

        // Define search conditions based on search type
        switch (searchType) {
            case 'brand':
                searchConditions = { brand: { $regex: new RegExp(searchQuery, 'i') } };
                break;
            case 'store':
                searchConditions = { store: { $regex: new RegExp(searchQuery, 'i') } };
                break;
            case 'productCode':
                searchConditions = { ProductCode: { $regex: new RegExp(searchQuery, 'i') } };
                break;
            default:
                searchConditions = { brand: { $regex: new RegExp(searchQuery, 'i') } }; // Default to brand search
                break;
        }

        const [Products] = await Promise.all([
            Product.find(searchConditions).skip(startIndex).limit(limit),
        ]);

        const allProducts = [...Products];

        const totalProducts = await Product.countDocuments(searchConditions);
        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({ success: true, data: allProducts, totalPages });
    } catch (error) {
        console.error('Error fetching all products:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

exports.fetchOutOfStockProducts = catchAsyncErrors(async (req, res, next) => {
    try {
        // Aggregation for Duplicate Products by productName
        const duplicateProductsByName = await Product.aggregate([
            {
                $group: {
                    _id: { productName: "$productName" },
                    count: { $sum: 1 },
                    products: { $push: "$$ROOT" }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        // Aggregation for Duplicate Products by productCode
        const duplicateProductsByCode = await Product.aggregate([
            {
                $group: {
                    _id: { productCode: "$productCode" },
                    count: { $sum: 1 },
                    products: { $push: "$$ROOT" }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        // Find Products with Invalid Stock or Missing storeName
        const invalidStockOrMissingStoreNameProducts = await Store.aggregate([
            {
                $match: {
                    $or: [
                        { stock: 0 },
                        { stock: { $exists: false } },
                        { stock: null },
                        { storeName: { $exists: false } },
                        { storeName: null }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $project: {
                    _id: 1,
                    storeName: 1,
                    stock: 1,
                    productId: 1,
                    productDetails: 1
                }
            }
        ]);

        const invalidAndDuplicateProducts = {
            duplicateProductsByName,
            duplicateProductsByCode,
            invalidStockOrMissingStoreNameProducts
        };

        res.status(200).json({
            success: true,
            outOfStock: invalidAndDuplicateProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
        });
    }
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

exports.updateProduct = catchAsyncErrors(async (req, res, next) => {
    try {
        console.log(req.body)
        const { id } = req.params;
        const updatedImageData = req.files ? req.files.image : null;
        let { stock, store, ...updatedProductData } = req.body;

        // Set stock to 0 if it's null
        stock = stock === null ? 0 : stock;

        // Parse additionalStock from request body
        const additionalStock = [];
        for (const key in req.body) {
            if (key.startsWith('additionalStock[') && key.endsWith('][store]')) {
                const index = key.match(/additionalStock\[(\d+)\]\[store\]/)[1];
                additionalStock[index] = additionalStock[index] || {};
                additionalStock[index].store = req.body[key];
            }
            if (key.startsWith('additionalStock[') && key.endsWith('][stock]')) {
                const index = key.match(/additionalStock\[(\d+)\]\[stock\]/)[1];
                additionalStock[index] = additionalStock[index] || {};
                additionalStock[index].stock = req.body[key];
            }
        }

        // Find the product by ID
        const product = await Product.findById(id);

        // If product is not found, return an error
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        // Process the main store stock update
        let mainStoreStock = await Store.findOne({ productId: id, storeName: store });

        if (!mainStoreStock) {
            // If store stock entry does not exist, create a new one
            mainStoreStock = new Store({
                productId: id,
                storeName: store,
                stock: stock
            });
        } else {
            // If store stock entry exists, update the stock
            mainStoreStock.stock = stock;
        }

        // Save the main store stock entry (whether new or updated)
        await mainStoreStock.save();

        // Process additional stock entries
        for (const additional of additionalStock) {
            if (additional && additional.store && additional.stock) {
                let storeStock = await Store.findOne({ productId: id, storeName: additional.store });

                if (!storeStock) {
                    // If store stock entry does not exist, create a new one
                    storeStock = new Store({
                        productId: id,
                        storeName: additional.store,
                        stock: additional.stock
                    });
                } else {
                    // If store stock entry exists, update the stock
                    storeStock.stock = additional.stock;
                }

                // Save each store stock entry (whether new or updated)
                await storeStock.save();
            }
        }

        if (updatedImageData) {
            // Delete the existing image from ImageKit
            if (product.image && product.image.fieldId) {
                await imagekit.deleteFile(product.image.fieldId);
            }

            // Upload the new image to ImageKit storage
            const { data, name } = updatedImageData;
            const uniqueFileName = `${Date.now()}_${uuidv4()}_${name}`;
            const { fileId, url } = await imagekit.upload({
                file: data,
                fileName: uniqueFileName,
                folder: '/groceryproducts'
            });

            updatedProductData.image = {
                url: url,
                fieldId: fileId
            };
        } else {
            // No new image provided, use existing image URL
            updatedProductData.image = product.image;
        }

        // Update the product with the updated data
        const updatedProduct = await Product.findByIdAndUpdate(id, updatedProductData, { new: true });

        // If everything is successful, return the updated product
        res.status(200).json({
            success: true,
            data: updatedProduct
        });
    } catch (error) {
        // If any error occurs, return a 500 internal server error
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


exports.updateOrderStatus=catchAsyncErrors(async(req,res,next)=>{
    try {
        const { orderId, newStatus } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: newStatus }, { new: true });
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, data: updatedOrder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
})

exports.adminSendMail = catchAsyncErrors(async (req, res, next) => {
    const admin = await Admin.findOne({ email: req.body.email }).exec()
    if (!admin) {
        return next(
            new ErrorHandler("Admin Not Found with this email address", 404)
        )
    }
    const url1 = `${req.protocol}://${req.get("host")}/admin/forget-link/${admin._id}`
    const url = `https://rgsgrocery.com/admin/forget-link/${admin._id}`
    sendmail(req, url1, res, url, next)
    res.json({ admin, url1 })
    admin.resetPassword = "1"
    await admin.save()
})

exports.adminForgetLink = catchAsyncErrors(async (req, res, next) => {
    console.log(req.body)
    const admin = await Admin.findById(req.params.id).exec();
    console.log(req.body.password)
    if (!admin) {
        return next(new ErrorHandler("Admin Not Found with this email address", 404));
    }

    if (admin.resetPassword === "1") {
        admin.resetPassword = "0";
        admin.password = req.body.password;
    } else {
        return next(new ErrorHandler("Link Expired", 404));
    }

    await admin.save();

    res.status(200).json({ message: "Password Updated Successfully" });
});