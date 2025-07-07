const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: [
      "ENTERTAINMENT",
      "NEWS",
      "MOVIES",
      "INFOTAINMENT",
      "KIDS",
      "MUSIC",
      "RELIGIOUS",
      "SPORTS",
    ],
  },
});

module.exports = mongoose.model("Channel", channelSchema);
