const express = require('express')
const router = express.Router()
const { isAuthenticated } = require('../middlewares/auth')
const { exploreProductById, filterCatProduct, getStoresByProductId, fetchByBrand, updateProductStock, fetchProductByStore, getProducts, searchProducts, filterAll } = require('../controllers/productController')

router.get('/getproduct', getProducts);

router.get('/category/:category', filterCatProduct);

router.get('/store/:store',fetchProductByStore)

router.get('/explore/:id', exploreProductById)

router.get('/searchProducts', searchProducts)

router.get('/filter',filterAll)

router.get('/brand/:brandName',fetchByBrand)

router.post('/updateProductStock/:productId', isAuthenticated, updateProductStock);

router.get('/stores/:productId', getStoresByProductId)

module.exports = router