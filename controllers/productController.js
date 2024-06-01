const Product=require('../models/product')
const imagekit = require('../utils/imagekit').initimagekit();
const { v4: uuidv4 } = require('uuid');
const ErrorHandler = require('../utils/ErrorHandler');
const { catchAsyncErrors } = require('../middlewares/catchAsyncError');
const mongoose=require('mongoose')
const Store=require('../models/StoreStock')
const Cart=require('../models/cart')
exports.getProducts = catchAsyncErrors(async (req, res, next) => {
    const page = req.query.page || 1; // Default to page 1 if not provided
    const limit = 1000;

    try {
        let query = {}; // Initialize an empty query object

        // Check if the preferred store is provided in the request
        if (req.query.preferredStore) {
            // If preferred store is provided, filter products by that store from the StoreStock schema
            const storeStocks = await Store.find({ storeName: req.query.preferredStore });
            const productIds = storeStocks.map(store => store.productId);
            query = { _id: { $in: productIds } }; // Filter by productIds array
        }

        // If preferred store not provided, return all products without filtering
        const totalCount = req.query.preferredStore ? await Product.countDocuments(query) : await Product.countDocuments(query); // Total number of products matching the query
        const totalPages = Math.ceil(totalCount / limit); // Total number of pages

        const productsWithStores = await Product.aggregate([
            {
                $match: query // Apply the query condition
            },
            {
                $lookup: {
                    from: 'storestocks', // Name of the collection to join
                    localField: '_id', // Field from the Product collection
                    foreignField: 'productId', // Field from the StoreStock collection
                    as: 'stores' // Output array field
                }
            },
            {
                $addFields: {
                    totalPages: totalPages // Add totalPages to each document
                }
            },
            {
                $project: {
                    totalPages: 0 // Exclude totalPages from the output
                }
            },
            {
                $skip: (page - 1) * limit // Skip products based on page number
            },
            {
                $limit: limit // Limit the number of products per page
            }
        ]);

        res.status(200).json({
            data: productsWithStores
        });
    } catch (error) {
        // Handle any errors that occur during fetching data
        return next(new ErrorHandler(error.message, 500));
    }
});



exports.filterCatProduct = catchAsyncErrors(async (req, res, next) => {
    try {
        const { category } = req.params;
        const page = req.query.page || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        // Use a case-insensitive regular expression for the category
        const categoryRegex = new RegExp(category, 'i');
        const products = await Product.find({ category: categoryRegex })
            .skip(skip)
            .limit(limit);
        const totalProducts = await Product.countDocuments({ category: categoryRegex });
        console.log(products)
        const totalPages = Math.ceil(totalProducts / limit);
        res.status(200).json({
            success: true,
            count: products.length,
            totalPages: totalPages,
            currentPage: page,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});



exports.searchProducts = catchAsyncErrors(async (req, res, next) => {
    let { searchTerm, category, store } = req.query;

    try {
        let query = {};

        // Convert store to lowercase for case-insensitive search
        // if (store) {
        //     store = store.toLowerCase();
        // }

        // Construct the MongoDB query based on the provided search parameters
        if (searchTerm) {
            // If searchTerm is provided, search for products matching the productName or description
            query.$or = [
                { productName: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        if (category && category !== 'All categories') {
            // If category is provided and it's not 'All categories', include category filter
            query.category = category;
        }

        // Perform the search query
        let products = await Product.find(query);

        if (store) {
            // If store is provided, filter products by store availability
            const productIds = products.map(product => product._id);
            const storeStocks = await Store.find({ productId: { $in: productIds }, storeName: store });

            const availableProductIds = storeStocks.map(stock => stock.productId.toString());
            products = products.filter(product => availableProductIds.includes(product._id.toString()));

            // Add stock information to the products
            products = products.map(product => {
                const stock = storeStocks.find(stock => stock.productId.toString() === product._id.toString());
                return { ...product.toObject(), stock: stock ? stock.stock : 0 };
            });
        }

        // Send response with search results
        res.status(200).json({
            success: true,
            count: products.length,
            products: products
        });
    } catch (error) {
        // Handle errors
        console.error(error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


exports.exploreProductById = catchAsyncErrors(async (req, res) => {
    const { id } = req.params;
    console.log(req.params)

    try {
        // Find the product by ID
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const storeStocks = await Store.find({ productId: id });
console.log(storeStocks)
        // Extract store names and stock values
        const stores = storeStocks.map(({ storeName, stock }) => ({ storeName, stock }));

        // Return the product along with store names and stock
        console.log(product,stores)
        return res.status(200).json({ success: true, data: { product, stores } });
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});





exports.fetchProductByStore = catchAsyncErrors(async (req, res, next) => {
    try {
        let { store } = req.params;
        // Make the store name case insensitive
        store = new RegExp(store, 'i');
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Find store stocks matching the store name
        const storeStocks = await Store.find({ storeName: { $regex: store } })
            .skip(skip)
            .limit(limit)
            .populate('productId'); // Populate the product details

        const totalProducts = await Store.countDocuments({ storeName: { $regex: store } });

        // Extract products from store stocks
        const products = storeStocks.map(stock => stock.productId);

        const totalPages = Math.ceil(totalProducts / limit);
        res.status(200).json({
            success: true,
            count: products.length,
            totalPages: totalPages,
            currentPage: page,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
exports.filterAll = catchAsyncErrors(async (req, res, next) => {
    try {
        let query = {};

        // Filter by brand (case insensitive)
        if (req.query.brand) {
            query.brand = { $regex: new RegExp(req.query.brand, 'i') };
        }

        // Filter by store
        if (req.query.store) {
            const storeStock = await Store.find({ storeName: req.query.store });
            const productIds = storeStock.map(stock => stock.productId);
            query._id = { $in: productIds };
        }

        // Filter by price range
        if (req.query.minPrice || req.query.maxPrice) {
            query.sellingPrice = {};
            if (req.query.minPrice) {
                query.sellingPrice.$gte = parseFloat(req.query.minPrice);
            }
            if (req.query.maxPrice) {
                query.sellingPrice.$lte = parseFloat(req.query.maxPrice);
            }
        }

        const filteredProducts = await Product.find(query);

        res.status(200).json({
            success: true,
            count: filteredProducts.length,
            data: filteredProducts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

exports.fetchByBrand = catchAsyncErrors(async (req, res, next) => {
    try {
        const { brandName } = req.params;
        console.log(brandName);

        // Use a case-insensitive regex for brand name search
        const products = await Product.find({ brand: { $regex: new RegExp(brandName, "i") } });

        if (!products || products.length === 0) {
            // Send an empty array if no products are found
            return res.status(200).json({ success: true, products: [] });
        }

        res.status(200).json({ success: true, products });
    } catch (error) {
        next(error);
    }
});

exports.updateProductStock = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { newStock,store } = req.body;
console.log(req.body)
        // Validate the productId, storeName, and stock
        if (!mongoose.Types.ObjectId.isValid(productId) || isNaN(newStock) || newStock < 0) {
            return res.status(400).json({ success: false, message: 'Invalid productId or stock value' });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let storeStock = await Store.findOne({ productId, storeName:store });

        if (!storeStock) {
            return res.status(404).json({ success: false, message: 'Store stock not found' });
        }

        // Update the stock for the existing store stock
        storeStock.stock = newStock;

        // Save the store stock
        await storeStock.save();
        await Cart.updateMany({ 'products.productId': productId }, { $set: { 'products.$.stock': newStock } });

        // Send a success response
        res.status(200).json({ success: true, message: 'Product stock updated successfully', product, storeStock });
    } catch (error) {
        next(error);
    }
});


exports.getStoresByProductId = catchAsyncErrors(async (req, res, next) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    const storeStocks = await Store.find({ productId }).populate('productId');

    if (!storeStocks || storeStocks.length === 0) {
        return res.status(404).json({ success: false, message: "No store stock information found for this product" });
    }

    const stores = storeStocks.map(stock => ({
        storeName: stock.storeName,
        stock: stock.stock,
    }));

    res.status(200).json({
        success: true,
        stores,
    });
});