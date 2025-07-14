const User = require("../models/User");
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { bio } = req.body;
    if (bio !== undefined) user.bio = bio;
    if (req.file) user.imageUrl = req.file.secure_url || req.file.url || req.file.path;

    await user.save();

    res.status(200).json({
      message: "Profile updated",
      imageUrl: user.imageUrl,
      bio: user.bio,
    });
  } catch (err) {
    console.error("Update profile error:", err.message);
    res.status(500).json({ message: "Server error while updating profile" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId);

    const stats = {
      uploadedNotes: 0,
      downloadedNotes: 0,
      reviewsReceived: 0,
      uploadedThisMonth: 0,
      downloadedThisMonth: 0,
      reviewsThisMonth: 0,
      averageRating: 0,
    };

    res.status(200).json({
      user: {
        username: user.username || user.name || "User",
        name: user.name,
        joinDate: user.createdAt,
        bio: user.bio || "",
        imageUrl: user.imageUrl || "",
      },
      stats,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ message: "Server error while loading dashboard" });
  }
};
