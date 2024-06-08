exports.sendToken = (user, statusCode, res) => {
    const token = user.getjwttoken();
    const expiresInMilliseconds = process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000;

    res.status(statusCode).json({
        success: true,
        id: user._id,
        token,
        expiresIn: expiresInMilliseconds
    });
};
