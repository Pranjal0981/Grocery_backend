require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const fileupload = require('express-fileupload');
const axios = require('axios');
const bodyParser = require('body-parser');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const { v4: uuidv4 } = require('uuid');
const Razorpay=require('razorpay')
const indexRouter = require('./routes/indexRouter');
const adminRouter = require('./routes/adminRouter');
const productRouter = require('./routes/productRouter');
const superAdminRouter = require('./routes/superAdminRouter');
const storeManager = require('./routes/storeRouter');
const paymentRoute=require('./routes/paymentRouter')
const PORT = process.env.PORT || 3000;
const app = express();
require('./models/config');

// CORS configuration
const corsOptions = {
    origin: true,
    credentials: true
};
exports.instance = new Razorpay({
    key_id: process.env.RAZORPAY_API_KEY,
    key_secret: process.env.RAZORPAY_APT_SECRET,
});
app.use(cors(corsOptions));

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    resave: true,
    saveUninitialized: false,
    secret: process.env.EXPRESS_SECRET,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
        sameSite: 'none'
    }
}));

app.use(logger('tiny'));
app.use(fileupload());

// Routes
app.get('/', (req, res) => {
    res.send('Hello');
});

app.use('/user', indexRouter);
app.use('/admin', adminRouter);
app.use('/superadmin', superAdminRouter);
app.use('/storemanager', storeManager);
app.use('/products', productRouter);
app.get("/api/getkey", (req, res) =>
    res.status(200).json({ key: process.env.RAZORPAY_API_KEY })
);

app.all("*", (req, res, next) => {
    res.status(404).send('404 - Not Found');
});


// Server listening
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
