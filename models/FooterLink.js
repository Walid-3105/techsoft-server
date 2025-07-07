const mongoose = require("mongoose");

const quickLinkSchema = new mongoose.Schema({
  name: String,
  url: String,
});

const socialLinkSchema = new mongoose.Schema({
  icon: String,
  url: String,
});

const contactSchema = new mongoose.Schema({
  phone: String,
  email: String,
  address: String,
});

const footerLinkSchema = new mongoose.Schema({
  contact: contactSchema,
  quickLinks: [quickLinkSchema],
  socialLinks: [socialLinkSchema],
});

module.exports = mongoose.model("FooterLink", footerLinkSchema);
