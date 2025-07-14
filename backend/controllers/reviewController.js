const Review = require("../models/Review");
const createOrUpdateReview = async (req, res) => {
  const { comment, rating } = req.body;
  const userId = req.user.userId;
  const noteId = req.params.noteId;

  if (!comment) return res.status(400).json({ message: "Comment is required" });
  if (
    rating === undefined ||
    rating === null ||
    rating === "" ||
    isNaN(Number(rating)) ||
    Number(rating) < 1 ||
    Number(rating) > 5
  ) {
    return res
      .status(400)
      .json({
        message: "Star rating is required and must be between 1 and 5.",
      });
  }

  try {
    const existing = await Review.findOne({ user: userId, note: noteId });

    if (existing) {
      existing.comment = comment;
      existing.rating = rating;
      existing.updatedAt = new Date();
      await existing.save();
      return res.json({ message: "Review updated", review: existing });
    }

    const newReview = await Review.create({
      user: userId,
      note: noteId,
      comment,
      rating,
    });
    res.status(201).json({ message: "Review added", review: newReview });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getReviewsForNote = async (req, res) => {
  try {
    const reviews = await Review.find({ note: req.params.noteId })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({
      user: req.user.userId,
      note: req.params.noteId,
    });
    if (!review) return res.status(404).json({ message: "Review not found" });

    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
module.exports = {
  createOrUpdateReview,
  getReviewsForNote,
  deleteReview,
};
