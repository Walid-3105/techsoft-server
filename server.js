const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const fs = require("fs").promises;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.error("MongoDB connection error:", error));

const Slider = require("./models/Slider");
const Channel = require("./models/Channel");
const FooterLink = require("./models/FooterLink");
const User = require("./models/User");
const Category = require("./models/Category");

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Use Cloudinary for image uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "my_project", // change as needed
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 800, height: 600, crop: "limit" }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.get("/api/sliders", async (req, res) => {
  const sliders = await Slider.find();
  res.json(sliders);
});

app.post("/api/sliders", upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file.path; // Cloudinary gives public URL here
    const newSlider = new Slider({ imageUrl });
    await newSlider.save();
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Slider upload error:", error);
    res.status(500).json({ error: "Failed to upload slider" });
  }
});

app.delete("/api/sliders/:id", async (req, res) => {
  try {
    const slider = await Slider.findById(req.params.id);
    if (!slider) return res.status(404).json({ error: "Slider not found" });

    const urlParts = slider.imageUrl.split("/");
    const filenameWithExt = urlParts[urlParts.length - 1]; // e.g., my-image.jpg
    const filenameWithoutExt = filenameWithExt.split(".")[0]; // my-image
    const folderPath = urlParts
      .slice(urlParts.indexOf("upload") + 1, -1)
      .join("/");
    const publicId = folderPath
      ? `${folderPath}/${filenameWithoutExt}`
      : filenameWithoutExt;

    await cloudinary.uploader.destroy(publicId);
    await Slider.deleteOne({ _id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete slider error:", error);
    res.status(500).json({ error: "Failed to delete slider" });
  }
});

app.get("/api/channels", async (req, res) => {
  const channels = await Channel.find();
  res.json(channels);
});

app.post("/api/channels", upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file.path;
    const newChannel = new Channel({
      imageUrl,
      category: req.body.category,
    });
    await newChannel.save();
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Channel upload error:", error);
    res.status(500).json({ error: "Failed to upload channel" });
  }
});

app.delete("/api/channels/:id", async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Extract public_id from Cloudinary URL
    const urlParts = channel.imageUrl.split("/");
    const filenameWithExt = urlParts[urlParts.length - 1]; // e.g., image123.jpg
    const filenameWithoutExt = filenameWithExt.split(".")[0]; // image123

    const folderPath = urlParts
      .slice(urlParts.indexOf("upload") + 1, -1)
      .join("/");

    const publicId = folderPath
      ? `${folderPath}/${filenameWithoutExt}`
      : filenameWithoutExt;

    // Delete image from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from MongoDB
    await Channel.deleteOne({ _id: req.params.id });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete channel error:", error);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

// Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Add a new category
app.post("/api/categories", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Category name required" });

  try {
    const exists = await Category.findOne({ name: name.toUpperCase() });
    if (exists)
      return res.status(400).json({ error: "Category already exists" });

    const category = new Category({ name: name.toUpperCase() });
    await category.save();
    res.json(category);
  } catch {
    res.status(500).json({ error: "Failed to add category" });
  }
});

// Delete a category
app.delete("/api/categories/:id", async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

app.get("/api/footer-links", async (req, res) => {
  try {
    const footerData = await FooterLink.findOne();
    if (!footerData) {
      return res.status(404).json({
        quickLinks: [],
        socialLinks: [],
        contact: {},
      });
    }
    res.json(footerData);
  } catch (error) {
    console.error("Failed to fetch footer links:", error);
    res.status(500).json({ error: "Failed to fetch footer links" });
  }
});

app.put("/api/footer-links/:section", async (req, res) => {
  try {
    const { section } = req.params;
    const update = req.body;

    if (!["contact", "quickLinks", "socialLinks"].includes(section)) {
      return res.status(400).json({ error: "Invalid section" });
    }

    const footer = await FooterLink.findOne();
    if (!footer) {
      return res.status(404).json({ error: "Footer data not found" });
    }

    if (section === "contact") {
      footer.contact = {
        phone: update.phone ?? footer.contact.phone,
        email: update.email ?? footer.contact.email,
        address: update.address ?? footer.contact.address,
      };
    } else if (section === "quickLinks" && Array.isArray(update.quickLinks)) {
      footer.quickLinks = update.quickLinks.map((link) => ({
        name: link.name,
        url: link.url,
        ...(link._id && mongoose.isValidObjectId(link._id)
          ? { _id: link._id }
          : {}),
      }));
    } else if (section === "socialLinks" && Array.isArray(update.socialLinks)) {
      footer.socialLinks = update.socialLinks.map((link) => ({
        icon: link.icon,
        url: link.url,
        ...(link._id && mongoose.isValidObjectId(link._id)
          ? { _id: link._id }
          : {}),
      }));
    }

    await footer.save();

    res.json({ success: true, data: footer });
  } catch (error) {
    console.error("Failed to update footer section:", error);
    res.status(500).json({ error: "Update failed", details: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
