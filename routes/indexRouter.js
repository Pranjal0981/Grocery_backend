const express = require('express')
const { currentUser, signUp, login, copyStore, logout, updateUser, generateReferralCode, updateCart, deleteUser, doPayment, updateProductQuantity,setAddressIndex, returnRequest, deleteAddress, addAddress, addToWishlist, fetchWishlist, deleteFromWishlist, fetchProducts, addToCart, deleteFromCart, fetchCartProducts, userforgetlink, userSendMail, userOrder, fetchUserOrder, contactUs, setPreferredStore, clearCart, selectAddressIndex, addToWallet } = require('../controllers/indexController')
const { isAuthenticated } = require('../middlewares/auth')
const { checkout, paymentVerification } = require('../controllers/paymentController')
const router = express.Router()


router.post('/signup', signUp)

router.post('/login', login)

router.get('/logout', logout)

router.post('/currentUser', isAuthenticated, currentUser)

router.post('/update/:id', isAuthenticated, updateUser)

router.delete('/deleteAccount/:id', isAuthenticated, deleteUser)

router.post('/send-mail', userSendMail)

router.post('/forget-link/:id', userforgetlink)

router.post('/addToWishlist/:userId', isAuthenticated, addToWishlist)

router.delete('/deleteFromWishlist/:userId/:productId', isAuthenticated, deleteFromWishlist)

router.get('/fetchWishlist/:id', isAuthenticated, fetchWishlist)

router.get('/fetchProducts', fetchProducts)

router.post('/addToCart/:userId', isAuthenticated, addToCart)

router.delete('/deleteFromCart/:userId/:productId', isAuthenticated, deleteFromCart)

router.get('/fetchCart/:userId', isAuthenticated, fetchCartProducts)

router.post('/addAddress', isAuthenticated, addAddress)

router.post('/selectStore/:userId', isAuthenticated, setPreferredStore)

router.delete('/deleteAddress/:userId/:index', isAuthenticated, deleteAddress)

router.get('/fetchOrders/:userId', isAuthenticated, fetchUserOrder)

router.post('/order/:userId', isAuthenticated, userOrder)

router.post('/order/returnRequest/:orderId',isAuthenticated,returnRequest)

router.post('/contactus',contactUs)

router.post('/:userId/setAddressIndex',isAuthenticated,selectAddressIndex)

router.post('/updatecart',isAuthenticated,updateCart)

router.post("/api/checkout",isAuthenticated,checkout);

router.post("/api/paymentverification", paymentVerification);

router.post('/clear-cart',isAuthenticated,clearCart)

router.post('/updateProductQuantity',isAuthenticated,updateProductQuantity)

router.post('/generateReferralCode',isAuthenticated,generateReferralCode)

router.post('/addToWallet/:userId',isAuthenticated,addToWallet)
// router.post('/copystore',copyStore)
module.exports = router