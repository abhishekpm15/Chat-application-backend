const express = require("express");
const bodyparser = require("body-parser");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");

app.use(bodyparser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.json());
const path = require("path");
require("dotenv").config();

var port = process.env.PORT || 3001;

mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tn0wwt0.mongodb.net/?retryWrites=true&w=majority`,
    {
      dbName: "Chat-applications",
    }
  )
  .then(() => {
    console.log("connected to db");
  })
  .catch((err) => {
    console.log(err);
  });

const User = new mongoose.Schema({
  id: String,
  email: String,
  name: String,
});

const UserFriends = new mongoose.Schema({
  id: String,
  friends: [
    {
      id: String,
      email: String,
      name: String,
    },
  ],
});

const Messages = new mongoose.Schema({
  sender_id: String,
  friends: [
    {
      id: String,
      messages: [
        {
          text: String,
          timestamps: {
            type: Date,
            default: Date.now,
          },
          sent: Boolean,
        },
      ],
    },
  ],
});

const model = mongoose.model("Users", User);
const model2 = mongoose.model("UserFriends", UserFriends);
const model3 = mongoose.model("Messages", Messages);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/get-friends/:user_id", (req, res) => {
  model2
    .find({ id: req.params.user_id })
    .then((result) => {
      if (result.length > 0) {
        // console.log("result");
        res.send(result[0].friends);
        // console.log(result[0].friends);
      } else {
        res.send(null);
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.post("/add-friends", async (req, res) => {
  const userId = req.body.id;
  const newFriends = req.body.friends;
  console.log(userId, newFriends);

  try {
    const existingUser = await model2.findOne({ id: userId });

    if (existingUser) {
      console.log(req.body.friends.id);
      const findFriend = await model2.findOne({
        "friends.id": req.body.friends.id,
      });
      if (findFriend) {
        console.log("Friend already exists");
        res.send("Friend already in you list");
      } else {
        existingUser.friends.push(newFriends);
        await existingUser.save();
        console.log("Friends added to an existing user");
        res.status(201).json(existingUser);
      }
    } else {
      const newUser = new model2({
        id: userId,
        friends: [newFriends],
      });
      await newUser.save();
      console.log("New user created with friends");
      res.status(201).json(newUser);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/get-user/:user_name", (req, res) => {
  console.log(req.params.user_name);
  model
    .find({ email: { $regex: req.params.user_name } })
    .then((result) => {
      res.send(result);
      if (result.length > 0) {
        console.log("User found", result);
      } else {
        console.log("No user Found with such username");
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

var corsOptions = {
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200,
};

app.post("/register/:user_id", cors(corsOptions), (req, res, next) => {
  console.log(req.body);
  const searchId = req.params.user_id;
  console.log(searchId);
  model
    .find({ id: searchId })
    .then((existingUsers) => {
      console.log("Existing Users", existingUsers);
      if (existingUsers.length > 0) {
        console.log("User already exists");
        res.status(409).json({ message: "User already exists" });
      } else {
        const data = new model(req.body);
        data
          .save()
          .then((savedUser) => {
            console.log("Saved User", savedUser);
            res.status(201).json(savedUser);
          })
          .catch((err) => {
            console.log(err);
            res.status(500).json({ message: "Internal server error" });
          });
      }
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
    });
});

app.post("/message/send-message", async (req, res) => {
  try {
    let senderResult = await model3.findOne({
      sender_id: req.body.sender_id,
    });

    if (!senderResult) {
      senderResult = new model3({
        sender_id: req.body.sender_id,
        friends: req.body.friends,
      });
      await senderResult
        .save()
        .then((response) => {
          res.send(req.body.friends.messages.text);
          // console.log(response);
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      let friendResult = await model3.findOne({
        "friends.id": req.body.friends.id,
      });
      if (!friendResult) {
        console.log("not found");
        await senderResult.friends.push({
          id: req.body.friends.id,
          messages: [
            {
              text: req.body.friends.messages.text,
              timestamps: new Date(),
              sent: req.body.friends.messages.sent,
            },
          ],
        });
        senderResult
          .save()
          .then((response) => {
            // console.log(response);
          })
          .catch((err) => {
            console.log(err);
          });
      } else {
        const receiverFriend = senderResult.friends.find(
          (friend) => friend.id === req.body.friends.id
        );
        await receiverFriend.messages.push({
          text: req.body.friends.messages.text,
          timestamps: new Date(),
          sent: req.body.friends.messages.sent,
        });
        await senderResult
          .save()
          .then((response) => {
            res.send(req.body.friends.messages.text);
            // console.log(response);
          })
          .catch((err) => {
            console.log(err);
          });
      }
      console.log("found");
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/message/get-messages", async (req, res) => {
  const { sender_id, friend_id } = req.body;
  try {
    const document = await model3.findOne({
      sender_id: sender_id,
      "friends.id": friend_id,
    });

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    const messages =
      document.friends.find((friend) => friend.id === friend_id)?.messages ||
      [];
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const server = app.listen(port, () => {
  console.log("listening on port 3001");
});

// app.get("/get-all-friends",async(req,res)=>{
//     await model.find().then(response=>{
//     res.send(response)
//     console.log('all friends',response)
//   }).catch(err=>{
//     console.log(err);
//   })
// })

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
  },
});

io.on("connection", (socket) => {
  console.log("connected to socket.io");

  socket.on("setup", (userData) => {
    socket.join(userData);
    console.log(userData);
    socket.emit("connected");
  });

  socket.on("join_chat", (room) => {
    socket.join(room);
    console.log("user joined room :" + room);
  });

  socket.on("new_message", ({ user_id, friend_id, messages }) => {
    console.log("new message received", { user_id, friend_id, messages });
    socket.in(user_id).emit("message_received", messages);
  });
});
