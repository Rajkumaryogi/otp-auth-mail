const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ message: 'No token' });
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'jwt-secret');
    const user = await User.findById(payload.userId).lean();
    if (!user) return res.status(401).json({ message: 'Invalid user' });
    req.user = { id: user._id, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
