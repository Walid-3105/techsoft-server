const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  category: {
    type: String,
    required: true, // ✅ Keep this to make sure category is not empty
  },
});

module.exports = mongoose.model("Channel", channelSchema);
