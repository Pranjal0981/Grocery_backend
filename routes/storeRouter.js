const express = require('express')
const { currentStoreManager, storeRegister, storeLogin, logoutStoreManager, storeforgetLink, getAllProducts,storeSendMail, storeForgetLink }=require('../controllers/storeController')
const { isAuthenticated } = require('../middlewares/auth')
const router = express.Router()

router.post('/register', storeRegister)

router.post('/login', storeLogin)

// router.get('/logout', logout)

router.post('/currentStoreManager', isAuthenticated, currentStoreManager)

router.post('/send-mail',storeSendMail)

router.post('/forget-link/:id', storeForgetLink)

router.get('/getAllProducts/:store',isAuthenticated,getAllProducts)
router.get('/logoutStore',logoutStoreManager)



module.exports=router