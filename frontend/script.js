let socket;

let myId = null;
let myName = null;
let currentReceiver = null;

const BASE = "https://finalchat-backend.onrender.com";

const chats = {};

const chat = document.getElementById("chat");
const usersDiv = document.getElementById("users");
const input = document.getElementById("msg");
const header = document.getElementById("header");

// SIGNUP
async function signup() {
  const res = await fetch(`${BASE}/signup`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      name: name.value,
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();
  alert(data.msg);
}

// LOGIN
async function login() {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();
  if (!res.ok) return alert(data.msg);

  myName = data.name;
  myId = data.userId;

  document.title = myName + " - Chat";

  socket = io(BASE, {
    auth: { token: data.token },
    transports: ["websocket", "polling"]
  });

  setupSocket();

  auth.style.display = "none";
  app.style.display = "flex";
}

// SOCKET
function setupSocket() {

  socket.on("connect", () => {
    socket.emit("getUsers");
  });

  socket.on("userList", (users) => {
    usersDiv.innerHTML = "";

    for (let id in users) {
      if (id === myId) continue;

      const div = document.createElement("div");
      div.className = "user";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.innerText = (users[id].name || "U")[0].toUpperCase();

      const nameDiv = document.createElement("div");
      nameDiv.innerText = users[id].name;

      div.appendChild(avatar);
      div.appendChild(nameDiv);

      div.onclick = () => {
        currentReceiver = id;
        header.innerText = users[id].name;
        chat.innerHTML = "";
        (chats[id] || []).forEach(renderMessage);
      };

      usersDiv.appendChild(div);
    }
  });

  socket.on("receiveMessage", (data) => {
    addMessage(data);
  });
}

// SEND
function send() {
  if (!input.value.trim() || !currentReceiver) return;

  const msg = {
    id: Date.now(),
    senderId: myId,
    receiverId: currentReceiver,
    text: input.value,
    time: new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})
  };

  socket.emit("sendMessage", msg);
  input.value = "";
}

// STORE
function addMessage(m) {
  const other = m.senderId === myId ? m.receiverId : m.senderId;

  if (!chats[other]) chats[other] = [];
  chats[other].push(m);

  if (currentReceiver === other) renderMessage(m);
}

// RENDER
function renderMessage(m) {
  if (document.getElementById(m.id)) return;

  const div = document.createElement("div");
  div.id = m.id;
  div.className = "msg " + (m.senderId === myId ? "sent" : "received");

  div.innerHTML = `
    <div>${m.text}</div>
    <div class="time">${m.time}</div>
  `;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// ENTER
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});