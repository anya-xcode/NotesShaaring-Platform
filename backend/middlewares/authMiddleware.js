const jwt = require("jsonwebtoken");
const protect = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      console.warn("⚠️ Token expired at:", err.expiredAt);
      return res.status(401).json({ message: "Token expired" });
    }
    console.error("Auth error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
};
module.exports = protect;





