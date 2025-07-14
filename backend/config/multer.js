const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("./cloudinary");
const path = require("path");
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "notes",
    resource_type: (file.mimetype === "application/pdf" || file.mimetype === "application/msword" || file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.mimetype === "application/vnd.ms-powerpoint" || file.mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation") ? "raw" : "auto",
    public_id: `${Date.now()}-${path.parse(file.originalname).name}`,
  }),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
module.exports = upload;
