const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// ✅ SOCKET CORS FIX
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

// ================= MODEL =================
const User = mongoose.model("User", {
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true }
});

// ================= VARIABLES =================
const users = {};
const SECRET = process.env.JWT_SECRET || "fallback_secret";

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ msg: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    await new User({ email, password: hash, name }).save();

    res.json({ msg: "User created" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ msg: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, name: user.name || user.email },
      SECRET
    );

    res.json({
      token,
      name: user.name || user.email,
      userId: user._id
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

// ================= SOCKET AUTH =================
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error("No token"));

  try {
    const decoded = jwt.verify(token, SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

// ================= SOCKET =================
io.on("connection", (socket) => {
  const userId = socket.user.id;
  const name = socket.user.name;

  console.log("Connected:", name);

  users[userId] = { socketId: socket.id, name };
  socket.userId = userId;

  io.emit("userList", users);

  socket.on("getUsers", () => {
    socket.emit("userList", users);
  });

  socket.on("sendMessage", (data) => {
    const receiver = users[data.receiverId];

    io.to(socket.id).emit("receiveMessage", data);

    if (receiver) {
      io.to(receiver.socketId).emit("receiveMessage", data);

      io.to(socket.id).emit("messageStatus", {
        id: data.id,
        status: "delivered"
      });
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.userId];
    io.emit("userList", users);
  });
});

// ================= START =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});