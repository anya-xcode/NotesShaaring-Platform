const mongoose = require("mongoose");
const answerSchema = new mongoose.Schema({
  doubtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doubt",
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Answer", answerSchema);
