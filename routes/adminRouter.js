const express = require('express')
const { registerAdmin, loginAdmin, currentAdmin, fetchOrders, updateProduct, fetchLastDayActiveUsers, fetchOutOfStockProducts, blockMembers, deleteUserByAdmin, fetchAllUsers, fetchAllProducts, uploadProducts, fetchProductStockByStore, deleteProducts, logoutAdmin, unblockMembers, fetchInactiveUser, updateOrderStatus, adminSendMail, adminForgetLink, deleteProduct } = require('../controllers/adminController')
const { isAuthenticated } = require('../middlewares/auth')
const router = express.Router()


router.post('/signup', registerAdmin)

router.post('/login',loginAdmin)

router.post('/currentAdmin',isAuthenticated,currentAdmin)

router.post('/upload-products',uploadProducts)

router.get('/fetchProductStore/:storeName', isAuthenticated, fetchProductStockByStore);

router.get('/fetchorders/:store',isAuthenticated,fetchOrders)

router.delete('/deleteProducts/:store/:productId', isAuthenticated, deleteProduct)

router.put('/updateProduct/:id', isAuthenticated, updateProduct)

router.get('/getallproduct', isAuthenticated, fetchAllProducts)

router.get('/logout',logoutAdmin)

router.get('/fetchOutOfStock', isAuthenticated, fetchOutOfStockProducts)

router.put('/order/updateStatus',isAuthenticated,updateOrderStatus)

router.post('/send-mail',adminSendMail)

router.post('/forget-link/:id', adminForgetLink)

module.exports = router