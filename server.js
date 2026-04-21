require("dotenv").config();
console.log("API KEY:", process.env.GEMINI_API_KEY);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// 🔥 MongoDB connection (IMPORTANT FIX)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected 🔥"))
  .catch((err) => console.log(err));

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

// ✅ Test route
app.get("/", (req, res) => {
  res.send("Server running 🚀");
});

// ✅ NEW ROUTE (IMPORTANT 🔥)
app.get("/api/users", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// 🔥 Signup
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "User exists ❌" });

  await new User({ name, email, password }).save();
  res.json({ message: "Signup success 🔥" });
});

// 🔥 Login
app.post("/login", async (req, res) => {
  const user = await User.findOne(req.body);

  if (!user) return res.status(400).json({ message: "Invalid ❌" });

  res.json({ message: "Login success 🔥", user });
});

// 🔥 Create Group
app.post("/create-group", async (req, res) => {
  const { name, email } = req.body;

  const group = await new Group({
    name,
    members: [email],
    requests: [],
    tracker: [],
  }).save();

  res.json({ group });
});

// 🔥 Join Group
app.post("/join-group", async (req, res) => {
  const { groupId, email } = req.body;

  const g = await Group.findById(groupId);

  if (g.members.includes(email))
    return res.json({ message: "Already joined ✅" });

  if (g.requests.includes(email))
    return res.json({ message: "Request already sent ⏳" });

  g.requests.push(email);
  await g.save();

  res.json({ message: "Request sent 🔥" });
});

// 🔥 Approve
app.post("/approve", async (req, res) => {
  const { groupId, email } = req.body;

  const g = await Group.findById(groupId);

  g.requests = g.requests.filter((r) => r !== email);
  if (!g.members.includes(email)) g.members.push(email);

  await g.save();

  res.json({ message: "Approved ✅" });
});

// 🔥 Leave
app.post("/leave-group", async (req, res) => {
  const { groupId, email } = req.body;

  const g = await Group.findById(groupId);
  g.members = g.members.filter((m) => m !== email);

  await g.save();

  res.json({ message: "Left group" });
});

// 🔥 Tracker
app.post("/track", async (req, res) => {
  const { groupId, email, hours } = req.body;

  const g = await Group.findById(groupId);
  g.tracker.push({ email, hours });

  await g.save();

  res.json({ message: "Tracked" });
});

// 🔥 Chat send
app.post("/chat", async (req, res) => {
  const { groupId, message } = req.body;

  await new Chat({ groupId, message }).save();

  res.json({ message: "Sent" });
});

// 🔥 Chat get
app.get("/chat/:id", async (req, res) => {
  const data = await Chat.find({ groupId: req.params.id });
  res.json(data);
});

// 🔥 Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = await new File({
    groupId: req.body.groupId,
    name: req.file.originalname,
    path: req.file.path,
  }).save();

  res.json({ message: "Uploaded", file });
});

// 🔥 Get files
app.get("/files/:id", async (req, res) => {
  const files = await File.find({ groupId: req.params.id });
  res.json(files);
});

// 🔥 Get single group
app.get("/group/:id", async (req, res) => {
  const g = await Group.findById(req.params.id);
  res.json({ group: g });
});

// 🔥 Get all groups
app.get("/groups", async (req, res) => {
  const g = await Group.find();
  res.json({ groups: g });
});

// 🔥 Delete
app.delete("/delete-group/:id", async (req, res) => {
  await Group.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ================= 🤖 AI =================

app.post("/ai", async (req, res) => {
  try {
    const { prompt } = req.body;

    const API_KEY = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
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

app.listen(5000, () => {
  console.log("Server started on port 5000 🚀");
});