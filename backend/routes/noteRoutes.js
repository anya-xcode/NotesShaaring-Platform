const express = require("express");
const protect = require("../middlewares/authMiddleware");
const router = express.Router();
const upload = require("../config/multer");
const Note = require("../models/Note");
const Review = require("../models/Review");
const path = require("path");
const fs = require("fs");
const { estimateDifficulty } = require("../utils/difficultyEstimator");
const { getRelatedVideos } = require("../utils/youtubeApi");
const { getRelatedArticles } = require("../utils/googleSearchApi");

// Upload a note
router.post("/", protect, upload.single("file"), async (req, res) => {
  try {
    const { title, subject, description, difficulty } = req.body;
    console.log("Received difficulty:", difficulty);

    if (!req.file || !title || !subject) {
      return res
        .status(400)
        .json({ message: "File, title, and subject are required" });
    }

    const fileUrl = req.file.secure_url || req.file.url || req.file.path;

    let finalDifficulty = difficulty;
    if (
      !finalDifficulty ||
      !["Basic", "Intermediate", "Advanced"].includes(finalDifficulty)
    ) {
      const est = estimateDifficulty({ title, description });
      if (est === "Easy") finalDifficulty = "Basic";
      else if (est === "Medium") finalDifficulty = "Intermediate";
      else if (est === "Hard") finalDifficulty = "Advanced";
      else finalDifficulty = undefined;
    }

    const newNote = new Note({
      title,
      subject,
      description,
      fileUrl,
      uploadedBy: req.user.userId,
      downloadedBy: [],
      downloadCount: 0,
      likedBy: [],
      difficulty: finalDifficulty,
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

// Fetch all notes
router.get("/", async (req, res) => {
  try {
    const notes = await Note.find()
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "username email")
      .populate("downloadedBy", "_id");

    const reviewCounts = await Review.aggregate([
      { $group: { _id: "$note", count: { $sum: 1 } } },
    ]);

    const reviewCountMap = {};
    reviewCounts.forEach((rc) => {
      reviewCountMap[rc._id.toString()] = rc.count;
    });

    const notesWithExtras = notes.map((note) => {
      const n = note.toObject();
      n.reviewCount = reviewCountMap[n._id.toString()] || 0;
      n.likes = note.likedBy?.length || 0;
      return n;
    });

    res.status(200).json({ notes: notesWithExtras });
  } catch (err) {
    console.error("Fetch notes error:", err);
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

// Fetch user's favorite notes
router.get("/favorites", protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    const notes = await Note.find({ likedBy: userId })
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "username email");

    res.status(200).json(notes);
  } catch (err) {
    console.error("Fetch favorites error:", err);
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
});

// Get a single note
router.get("/:id", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate(
      "uploadedBy",
      "username email"
    );
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

// Like or unlike a note
router.put("/:id/like", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const userId = req.user.userId;
    const alreadyLiked = note.likedBy.includes(userId);

    if (alreadyLiked) {
      note.likedBy = note.likedBy.filter((id) => id.toString() !== userId);
    } else {
      note.likedBy.push(userId);
    }

    await note.save();

    res.status(200).json({
      message: alreadyLiked ? "Unliked" : "Liked",
      likedBy: note.likedBy,
      likeCount: note.likedBy.length,
    });
  } catch (err) {
    console.error("Like toggle error:", err);
    res.status(500).json({ message: "Server error while liking note" });
  }
});

// Add to favorites
router.post("/:id/favorite", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const userId = req.user.userId;
    if (!note.likedBy.includes(userId)) {
      note.likedBy.push(userId);
      await note.save();
    }

    res.status(200).json({
      message: "Added to favorites",
      likedBy: note.likedBy,
      likeCount: note.likedBy.length,
    });
  } catch (err) {
    console.error("Add to favorites error:", err);
    res.status(500).json({ message: "Server error while adding to favorites" });
  }
});

// Remove from favorites
router.delete("/:id/favorite", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const userId = req.user.userId;
    note.likedBy = note.likedBy.filter((id) => id.toString() !== userId);
    await note.save();

    res.status(200).json({
      message: "Removed from favorites",
      likedBy: note.likedBy,
      likeCount: note.likedBy.length,
    });
  } catch (err) {
    console.error("Remove from favorites error:", err);
    res
      .status(500)
      .json({ message: "Server error while removing from favorites" });
  }
});

// Delete a note
router.delete("/:id", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (note.uploadedBy.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to delete this note" });
    }

    await note.deleteOne();
    res.status(200).json({ message: "Note deleted successfully" });
  } catch (err) {
    console.error("Delete note error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Edit a note
router.patch("/:id", protect, upload.single("file"), async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (note.uploadedBy.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to edit this note" });
    }

    if (req.body.title) note.title = req.body.title;
    if (req.body.subject) note.subject = req.body.subject;
    if (req.body.description) note.description = req.body.description;
    if (req.file) note.fileUrl = req.file.path;
    if (req.body.difficulty) note.difficulty = req.body.difficulty;

    await note.save();
    res.status(200).json({ message: "Note updated successfully", note });
  } catch (err) {
    console.error("Update note error:", err);
    res.status(500).json({ message: "Server error while updating note" });
  }
});

// Download file
router.get("/:id/download-file", protect, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const filePath = note.fileUrl;

    if (filePath.startsWith("http")) {
      return res.redirect(filePath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(filePath)}"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error("File download error:", err);
    res.status(500).json({ message: "Server error while downloading file" });
  }
});

// Get related YouTube videos for a note
router.get("/:id/related-videos", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    const relatedVideos = await getRelatedVideos(note);
    
    res.status(200).json({
      message: "Related videos fetched successfully",
      data: relatedVideos
    });
  } catch (err) {
    console.error("Fetch related videos error:", err);
    res.status(500).json({ message: "Server error while fetching related videos" });
  }
});

// Fetch related articles for a note
router.get("/:id/related-articles", async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const relatedArticles = await getRelatedArticles(note);
    res.status(200).json({
      message: "Related articles fetched successfully",
      data: relatedArticles,
    });
  } catch (err) {
    console.error("Fetch related articles error:", err);
    res.status(500).json({ message: "Server error while fetching related articles" });
  }
});

module.exports = router;
