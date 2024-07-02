require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const fileupload = require('express-fileupload');
const bodyParser = require('body-parser');
const MongoStore = require('connect-mongo');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const { v4: uuidv4 } = require('uuid');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const Razorpay = require('razorpay');
const User = require('./models/userModel'); // Assuming you have a User model
const indexRouter = require('./routes/indexRouter');
const adminRouter = require('./routes/adminRouter');
const productRouter = require('./routes/productRouter');
const superAdminRouter = require('./routes/superAdminRouter');
const storeManager = require('./routes/storeRouter');
const paymentRoute = require('./routes/paymentRouter');
const PORT = process.env.PORT || 3000;
const app = express();
require('./models/config');

// CORS configuration
const corsOptions = {
    origin: true,
    credentials:true
};

// Enable CORS
app.use(cors(corsOptions));

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
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
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

// Passport configuration
passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async function (email, password, done) {
        try {
            const user = await User.findOne({ email });

            if (!user) {
                return done(null, false, { message: 'Incorrect email.' });
            }

            const isValidPassword = await user.isValidPassword(password);

            if (!isValidPassword) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

app.use(passport.initialize());
app.use(passport.session());

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

// Authentication routes
app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/');
    });

app.all("*", (req, res, next) => {
    res.status(404).send('404 - Not Found');
});

// Server listening
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
