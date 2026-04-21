require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected 🔥"))
  .catch((err) => console.log("Mongo Error:", err));

// ================= MODELS =================
const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String
});

const Group = mongoose.model("Group", {
  name: String,
  members: [String],
  requests: { type: [String], default: [] },
  tracker: { type: [{ email: String, hours: Number }], default: [] },
});

const Chat = mongoose.model("Chat", {
  groupId: String,
  message: String,
});

const File = mongoose.model("File", {
  groupId: String,
  name: String,
  path: String,
});

// ================= FILE UPLOAD =================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ================= ROUTES =================

// Test route
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ✅ USERS API
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User exists ❌" });

    await new User({ name, email, password }).save();
    res.json({ message: "Signup success 🔥" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne(req.body);

    if (!user) return res.status(400).json({ message: "Invalid ❌" });

    res.json({ message: "Login success 🔥", user });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Group
app.post("/create-group", async (req, res) => {
  try {
    const { name, email } = req.body;

    const group = await new Group({
      name,
      members: [email],
      requests: [],
      tracker: [],
    }).save();

    res.json({ group });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join Group
app.post("/join-group", async (req, res) => {
  try {
    const { groupId, email } = req.body;

    const g = await Group.findById(groupId);

    if (g.members.includes(email))
      return res.json({ message: "Already joined ✅" });

    if (g.requests.includes(email))
      return res.json({ message: "Request already sent ⏳" });

    g.requests.push(email);
    await g.save();

    res.json({ message: "Request sent 🔥" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve
app.post("/approve", async (req, res) => {
  try {
    const { groupId, email } = req.body;

    const g = await Group.findById(groupId);

    g.requests = g.requests.filter((r) => r !== email);
    if (!g.members.includes(email)) g.members.push(email);

    await g.save();

    res.json({ message: "Approved ✅" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave Group
app.post("/leave-group", async (req, res) => {
  try {
    const { groupId, email } = req.body;

    const g = await Group.findById(groupId);
    g.members = g.members.filter((m) => m !== email);

    await g.save();

    res.json({ message: "Left group" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tracker
app.post("/track", async (req, res) => {
  try {
    const { groupId, email, hours } = req.body;

    const g = await Group.findById(groupId);
    g.tracker.push({ email, hours });

    await g.save();

    res.json({ message: "Tracked" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat send
app.post("/chat", async (req, res) => {
  try {
    const { groupId, message } = req.body;

    await new Chat({ groupId, message }).save();

    res.json({ message: "Sent" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat get
app.get("/chat/:id", async (req, res) => {
  try {
    const data = await Chat.find({ groupId: req.params.id });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = await new File({
      groupId: req.body.groupId,
      name: req.file.originalname,
      path: req.file.path,
    }).save();

    res.json({ message: "Uploaded", file });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get files
app.get("/files/:id", async (req, res) => {
  try {
    const files = await File.find({ groupId: req.params.id });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get group
app.get("/group/:id", async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    res.json({ group: g });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all groups
app.get("/groups", async (req, res) => {
  try {
    const g = await Group.find();
    res.json({ groups: g });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete group
app.delete("/delete-group/:id", async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= AI =================
app.post("/ai", async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= START =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT} 🚀`);
});