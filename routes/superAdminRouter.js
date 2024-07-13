const express = require('express')
const { registerSuperAdmin, loginSuperAdmin, currentSuperAdmin, getUserQuery, fetchAllUsers, unblockMembers, blockMembers, deleteUserBySuperAdmin, fetchLastDayActiveUsers,fetchInactiveUser, logoutSuperAdmin, fetchInfoForDashboard, superAdminSendMail, superAdminForgetLink, searchUser, getAllAdmin, createAdmin, updatePermission } = require('../controllers/superAdminController')
const { isAuthenticated } = require('../middlewares/auth')
const router = express.Router()


router.post('/signup', registerSuperAdmin)

router.post('/login', loginSuperAdmin)

router.post('/currentSuperAdmin',isAuthenticated,currentSuperAdmin)

router.get('/logout', logoutSuperAdmin)

router.get('/fetchAllUsers', isAuthenticated, fetchAllUsers)

router.post('/blockUser/:userId', isAuthenticated, blockMembers)

router.post('/unblockUser/:userId', isAuthenticated, unblockMembers)

router.delete('/deleteUser/:userId', isAuthenticated, deleteUserBySuperAdmin);

router.get('/fetchLastHourActiveUsers', isAuthenticated, fetchLastDayActiveUsers);

router.get('/fetchInactiveUsers', isAuthenticated, fetchInactiveUser)

router.get('/dashboard/fetchAllInfo', isAuthenticated, fetchInfoForDashboard)

router.post('/send-mail', superAdminSendMail)

router.post('/forget-link/:token', superAdminForgetLink)

router.get('/searchUser',isAuthenticated,searchUser)

router.get('/getUserQuery', isAuthenticated, getUserQuery)

router.get('/getAlladmins',isAuthenticated,getAllAdmin)

router.post('/createAdmin',isAuthenticated, createAdmin);

router.post('/updatePermissions',updatePermission)
module.exports=router
