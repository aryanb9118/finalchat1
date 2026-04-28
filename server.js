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

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

// ROUTE TEST
app.get("/", (req, res) => {
  res.send("Server running");
});

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log("MongoDB Connected"))
  .catch(err=>console.log(err));

// MODEL
const User = mongoose.model("User", {
  email:String,
  password:String,
  name:String
});

const users = {};
const SECRET = process.env.JWT_SECRET;

// SIGNUP
app.post("/signup", async (req,res)=>{
  const {email,password,name}=req.body;

  const exists = await User.findOne({email});
  if (exists) return res.json({msg:"Email exists"});

  const hash = await bcrypt.hash(password,10);
  await new User({email,password:hash,name}).save();

  res.json({msg:"User created"});
});

// LOGIN
app.post("/login", async (req,res)=>{
  const {email,password}=req.body;

  const user = await User.findOne({email});
  if (!user) return res.json({msg:"User not found"});

  const ok = await bcrypt.compare(password,user.password);
  if (!ok) return res.json({msg:"Wrong password"});

  const token = jwt.sign(
    {id:user._id,name:user.name},
    SECRET
  );

  res.json({
    token,
    name:user.name,
    userId:user._id
  });
});

// AUTH
io.use((socket,next)=>{
  try{
    const decoded = jwt.verify(socket.handshake.auth.token, SECRET);
    socket.user = decoded;
    next();
  }catch{
    next(new Error("Auth error"));
  }
});

// SOCKET
io.on("connection",(socket)=>{
  const {id,name}=socket.user;

  users[id]={socketId:socket.id,name};

  io.emit("userList",users);

  socket.on("getUsers",()=>{
    socket.emit("userList",users);
  });

  socket.on("sendMessage",(data)=>{
    const receiver=users[data.receiverId];

    io.to(socket.id).emit("receiveMessage",data);

    if(receiver){
      io.to(receiver.socketId).emit("receiveMessage",data);
    }
  });

  socket.on("disconnect",()=>{
    delete users[socket.user.id];
    io.emit("userList",users);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, ()=>console.log("Server running on "+PORT));