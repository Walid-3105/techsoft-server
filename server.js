const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const fs = require("fs").promises;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((err) => cb(err));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
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
    if (!req.file) {
      console.error("No file uploaded in request");
      return res.status(400).json({ error: "No file uploaded" });
    }
    console.log("File uploaded:", {
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
    });
    const imageUrl = `/uploads/${req.file.filename}`;
    const newSlider = new Slider({ imageUrl });
    await newSlider.save();
    console.log("Slider saved to database:", imageUrl);
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Slider upload error:", {
      message: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ error: "Failed to upload slider", details: error.message });
  }
});

app.delete("/api/sliders/:id", async (req, res) => {
  try {
    const slider = await Slider.findById(req.params.id);
    if (!slider) return res.status(404).json({ error: "Slider not found" });
    const filePath = path.join(
      __dirname,
      "uploads",
      slider.imageUrl.split("/uploads/")[1]
    );
    try {
      await fs.unlink(filePath);
      console.log(`File deleted: ${filePath}`);
    } catch (error) {
      console.error(`Failed to delete file: ${filePath}`, error);
    }
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
    if (!req.file || !req.body.category) {
      return res.status(400).json({ error: "Missing file, name, or category" });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    const newChannel = new Channel({
      imageUrl,
      category: req.body.category,
    });
    await newChannel.save();
    console.log("Channel saved to database:", {
      category: req.body.category,
      imageUrl,
    });
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error("Channel upload error:", {
      message: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json({ error: "Failed to upload channel", details: error.message });
  }
});

app.delete("/api/channels/:id", async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    const filePath = path.join(
      __dirname,
      "uploads",
      channel.imageUrl.split("/uploads/")[1]
    );
    try {
      await fs.unlink(filePath);
      console.log(`File deleted: ${filePath}`);
    } catch (fileError) {
      console.warn(`Failed to delete file: ${filePath}`, fileError);
    }
    await Channel.deleteOne({ _id: req.params.id });
    console.log(`Channel deleted from database: ${req.params.id}`);
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
