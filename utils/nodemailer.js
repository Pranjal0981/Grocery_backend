const nodemailer = require('nodemailer');
const ErrorHandler = require('./ErrorHandler');

exports.sendmail = async (req, url1, res, url, next) => {
    try {
        const transport = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: process.env.MAIL_EMAIL,
                pass: process.env.MAIL_PASSWORD
            }
        });

        const mailoptions = {
            from: 'RGS Grocery <noreply@rgsgrocery.com>',
            to: req.body.email,
            subject: 'Password Reset Link',
            html: `
                <h1>Hello,</h1>
                <p>We received a request to reset your password. Click the link below to proceed:</p>
                <p><a href="${url}">${url}</a></p>
                <p>If you did not request a password reset, please ignore this email.</p>
                <p>Thank you,<br/>RGS Grocery</p>
            `
        };

        const info = await transport.sendMail(mailoptions);

        if (process.env.NODE_ENV === 'development') {
            console.log('Email sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return res.status(200).json({
            message: 'Email sent successfully',
            url
        });
    } catch (err) {
        return next(new ErrorHandler(err.message || 'Failed to send email', 500));
    }
};
