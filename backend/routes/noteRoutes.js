const express = require("express");
const protect = require("../middlewares/authMiddleware");
const router = express.Router();
const upload = require("../config/multer");
const Note = require("../models/Note");
const Review = require("../models/Review");
const path = require("path");
const fs = require("fs");

// Upload a new note
router.post("/", protect, upload.single("file"), async (req, res) => {
  try {
    const { title, subject, description } = req.body;
    if (!req.file || !title || !subject) {
      return res.status(400).json({ message: "File, title, and subject are required" });
    }

    const newNote = new Note({
      title,
      subject,
      description,
      fileUrl: req.file.path,
      uploadedBy: req.user.userId,
      downloadedBy: [],
      downloadCount: 0,
    });

    await newNote.save();

    res.status(201).json({
      message: "Note uploaded successfully",
      note: newNote,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Server error while uploading note" });
  }
});

// Get all notes with review count
router.get("/", async (req, res) => {
  try {
    const notes = await Note.find()
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "username email");

    const reviewCounts = await Review.aggregate([
      { $group: { _id: "$note", count: { $sum: 1 } } }
    ]);

    const reviewCountMap = {};
    reviewCounts.forEach(rc => {
      reviewCountMap[rc._id.toString()] = rc.count;
    });

    const notesWithReviewCount = notes.map(note => {
      const n = note.toObject();
      n.reviewCount = reviewCountMap[n._id.toString()] || 0;
      return n;
    });

    res.status(200).json({ notes: notesWithReviewCount });
  } catch (err) {
    console.error("Fetch notes error:", err);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

// Get a single note
router.get("/:id", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate("uploadedBy", "username email");
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.status(200).json({ note });
  } catch (err) {
    console.error("Fetch single note error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Track downloads
router.put("/:id/download", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const userId = req.user.userId;
    if (!note.downloadedBy.includes(userId)) {
      note.downloadedBy.push(userId);
    }

    note.downloadCount += 1;
    await note.save();

    res.status(200).json({ message: "Download tracked", note });
  } catch (err) {
    console.error("Download tracking error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a note
router.delete("/:id", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (note.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Unauthorized to delete this note" });
    }

    await note.deleteOne();
    res.status(200).json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error("Delete note error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update a note
router.patch("/:id", protect, upload.single("file"), async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (note.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Unauthorized to edit this note" });
    }

    if (req.body.title) note.title = req.body.title;
    if (req.body.subject) note.subject = req.body.subject;
    if (req.body.description) note.description = req.body.description;
    if (req.file) note.fileUrl = req.file.path;

    await note.save();
    res.status(200).json({ message: "Note updated successfully", note });
  } catch (err) {
    console.error("Update note error:", err);
    res.status(500).json({ message: "Server error while updating note" });
  }
});

// Download actual file
router.get("/:id/download-file", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const filePath = note.fileUrl;

    // If file is stored on Cloudinary (http/https link), redirect
    if (filePath.startsWith("http")) {
      return res.redirect(filePath);
    }

    // If file is stored locally
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("File download error:", err);
    res.status(500).json({ message: "Server error while downloading file" });
  }
});

module.exports = router;
