const Product=require('../models/product')
const imagekit = require('../utils/imagekit').initimagekit();
const { v4: uuidv4 } = require('uuid');
const ErrorHandler = require('../utils/ErrorHandler');
const { catchAsyncErrors } = require('../middlewares/catchAsyncError');
const mongoose=require('mongoose')
const Store=require('../models/StoreStock')
const Cart=require('../models/cart')
const jwt=require('jsonwebtoken')
exports.getProducts = catchAsyncErrors(async (req, res, next) => {
    const page = req.query.page || 1; // Default to page 1 if not provided
    const limit = 5000;

    try {
        let query = {}; // Initialize an empty query object

        if (req.query.preferredStore) {
            // If the user has a preferred store, filter products by that store from the StoreStock schema
            const storeStocks = await Store.find({ storeName: req.query.preferredStore });
            const productIds = storeStocks.map(store => store.productId);
            query = { _id: { $in: productIds } }; // Filter by productIds array
        }

        // If the user is not authenticated or does not have a preferred store, return all products without filtering
        const totalCount = req.query.preferredStore ?
            await Product.countDocuments(query) :
            await Product.countDocuments(); // Total number of products matching the query

        const totalPages = Math.ceil(totalCount / limit); // Total number of pages

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

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
                $skip: skip // Skip documents
            },
            {
                $limit: limit // Limit the number of documents returned
            }
        ]);

        const products = productsWithStores.map(product => {
            return product;
        });

        res.status(200).json({
            success: true,
            count: products.length,
            totalPages,
            products
        });
    } catch (error) {
        next(error);
    }
});





exports.filterCatProduct = catchAsyncErrors(async (req, res, next) => {
    try {
        const { category } = req.params;
        if (!category) {
            return res.status(400).json({
                success: false,
                error: "Category parameter is required."
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 30000;
        const skip = (page - 1) * limit;

        // Use a case-insensitive regular expression for the category
        const categoryRegex = new RegExp(category, 'i');
        const products = await Product.find({ category: categoryRegex })
            .skip(skip)
            .limit(limit);

        // Fetch stock information for all products from all stores
        const productIds = products.map(product => product._id);
        const storeStocks = await Store.find({ productId: { $in: productIds } });

        // Group store stocks by productId
        const stockByProduct = storeStocks.reduce((acc, stock) => {
            const productId = stock.productId.toString();
            if (!acc[productId]) {
                acc[productId] = [];
            }
            acc[productId].push(stock);
            return acc;
        }, {});

        // Add stock information to the products
        const productsWithStock = products.map(product => {
            const stores = stockByProduct[product._id.toString()] || [];
            const totalStock = stores.reduce((total, stock) => total + stock.stock, 0);
            const outOfStock = totalStock <= 0;
            return { ...product.toObject(), stores, outOfStock, totalStock };
        });

        const totalProducts = await Product.countDocuments({ category: categoryRegex });
        const totalPages = Math.ceil(totalProducts / limit);

        res.status(200).json({
            success: true,
            count: products.length,
            totalPages: totalPages,
            currentPage: page,
            data: productsWithStock
        });
    } catch (error) {
        console.error(error);
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

        // Construct the MongoDB query based on the provided search parameters
        if (searchTerm) {
            query.$or = [
                { productName: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        if (category && category !== 'All categories') {
            query.category = category;
        }

        // Perform the search query
        let products = await Product.find(query);

        // Fetch stock information for all products from all stores
        const productIds = products.map(product => product._id);
        const storeStocks = await Store.find({ productId: { $in: productIds } });

        // Group store stocks by productId
        const stockByProduct = storeStocks.reduce((acc, stock) => {
            const productId = stock.productId.toString();
            if (!acc[productId]) {
                acc[productId] = [];
            }
            acc[productId].push(stock);
            return acc;
        }, {});

        // Add stock information to the products
        products = products.map(product => {
            const stores = stockByProduct[product._id.toString()] || [];
            return { ...product.toObject(), stores };
        });

        // Add outOfStock flag based on the preferred store or total stock
        products = products.map(product => {
            if (store) {
                const storeStock = product.stores.find(stock => stock.storeName === store);
                const outOfStock = !(storeStock && storeStock.stock > 0);
                return { ...product, outOfStock, stock: storeStock ? storeStock.stock : 0 };
            } else {
                const totalStock = product.stores.reduce((total, stock) => total + stock.stock, 0);
                const outOfStock = totalStock <= 0;
                return { ...product, outOfStock, stock: totalStock };
            }
        });

        console.log(products);

        // Send response with search results
        res.status(200).json({
            success: true,
            count: products.length,
            products: products
        });
    } catch (error) {
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

        // Fetch the filtered products
        let filteredProducts = await Product.find(query);

        if (filteredProducts.length === 0) {
            // Send an empty array if no products are found
            return res.status(200).json({ success: true, products: [] });
        }

        // Fetch stock information for all filtered products
        const productIds = filteredProducts.map(product => product._id);
        let storeStocks = await Store.find({ productId: { $in: productIds } });

        // If filtering by store
        if (req.query.store) {
            storeStocks = storeStocks.filter(stock => stock.storeName === req.query.store);
        }

        // Group store stocks by productId
        const stockByProduct = storeStocks.reduce((acc, stock) => {
            const productId = stock.productId.toString();
            if (!acc[productId]) {
                acc[productId] = [];
            }
            acc[productId].push(stock);
            return acc;
        }, {});

        // Add stock information to the products
        const productsWithStock = filteredProducts.map(product => {
            const stores = stockByProduct[product._id.toString()] || [];
            const totalStock = stores.reduce((total, stock) => total + stock.stock, 0);
            const outOfStock = totalStock <= 0;
            return {
                ...product.toObject(),
                stores: stores.map(store => ({
                    storeName: store.storeName,
                    stock: store.stock
                })),
                
            };
        });
        console.log(productsWithStock)

        res.status(200).json({
            success: true,
            count: productsWithStock.length,
            data: productsWithStock
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});



exports.fetchByBrand = catchAsyncErrors(async (req, res, next) => {
    try {
        const { brandName } = req.params;

        if (!brandName) {
            return res.status(400).json({ success: false, error: "Brand name parameter is required." });
        }

        // Use a case-insensitive regex for brand name search
        const products = await Product.find({ brand: { $regex: new RegExp(brandName, "i") } });

        if (!products || products.length === 0) {
            // Send an empty array if no products are found
            return res.status(200).json({ success: true, products: [] });
        }

        // Fetch stock information for all products from all stores
        const productIds = products.map(product => product._id);
        const storeStocks = await Store.find({ productId: { $in: productIds } });

        // Group store stocks by productId
        const stockByProduct = storeStocks.reduce((acc, stock) => {
            const productId = stock.productId.toString();
            if (!acc[productId]) {
                acc[productId] = [];
            }
            acc[productId].push(stock);
            return acc;
        }, {});

        // Add stock information to the products
        const productsWithStock = products.map(product => {
            const stores = stockByProduct[product._id.toString()] || [];
            const totalStock = stores.reduce((total, stock) => total + stock.stock, 0);
            const outOfStock = totalStock <= 0;
            return {
                ...product.toObject(),
                stores: stores.map(store => ({
                    storeName: store.storeName,
                    stock: store.stock
                })),
                outOfStock,
                totalStock
            };
        });

        res.status(200).json({
            success: true,
            count: productsWithStock.length,
            products: productsWithStock
        });
    } catch (error) {
        next(error);
    }
});



exports.updateProductStock = catchAsyncErrors(async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { newStock, store } = req.body;

        // Validate the productId and store
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Invalid productId' });
        }

        if (!store) {
            return res.status(400).json({ success: false, message: 'Store name is required' });
        }

        // Ensure newStock is a number and non-negative
        let updatedStock = parseInt(newStock, 10);
        if (isNaN(updatedStock) || updatedStock < 0) {
            updatedStock = 0;
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let storeStock = await Store.findOne({ productId, storeName: store });
        if (!storeStock) {
            return res.status(404).json({ success: false, message: 'Store stock not found' });
        }

        // Update the stock for the existing store stock
        storeStock.stock = updatedStock;

        // Save the store stock
        await storeStock.save();

        // Update the stock in all cart products
        await Cart.updateMany({ 'products.productId': productId }, { $set: { 'products.$.stock': updatedStock } });

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