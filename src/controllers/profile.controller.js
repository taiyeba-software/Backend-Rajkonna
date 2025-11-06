const User = require('../models/user.model');

const getProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Access token required' });
  const user = await User.findById(userId).select('name email phone address').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ user });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Access token required' });

    // Only allow phone and address updates
    const updates = {};
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.address !== undefined) {
      updates.address = {
        line1: req.body.address.line1 || '',
        line2: req.body.address.line2 || '',
        city: req.body.address.city || '',
        state: req.body.address.state || '',
        postalCode: req.body.address.postalCode || '',
        country: req.body.address.country || '',
      };
    }

    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select('name email phone address').lean();
    if (!updated) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getProfile, updateProfile };