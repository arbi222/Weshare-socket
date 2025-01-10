const port = process.env.PORT || 8900;
const io = require("socket.io")(port, {
    cors:{
        origin:["http://localhost:3000", "http://localhost:5173"],
    },
})

let users = []

const addUser = (userId, socketId) => {
    const user = users.find(user => user.userId === userId);
    if (user){
        if (!user.socketIds.includes(socketId)){
            user.socketIds.push(socketId);
        }
    }
    else{
        users.push({userId, socketIds: [socketId]});
    }
}

const removeUser = (socketId) => {
    users = users.map(user => {
        user.socketIds = user.socketIds.filter(id => id !== socketId);
        return user;
    }).filter(user => user.socketIds.length > 0);
}

const getUser = (userId) => {
    return users.find(user => user.userId === userId)
}

io.on("connection", (socket) => {
    console.log("a user connected!")
    
    socket.on("addUser", userId => {
        addUser(userId, socket.id)
        io.emit("getUsers", users);
    })
  
    // Handle WebRTC offer
    socket.on("sendOffer", ({callerId, receiverId, callType, chatId, offer }) => {
        const currentUser = getUser(callerId);
        const otherUser = getUser(receiverId);
        if (otherUser) {
            otherUser.socketIds.forEach((socketId) => {
                io.to(socketId).emit("receiveOffer", { callerId, callType, chatId, offer });
            });
        }
        else{
            currentUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("callingThem", {
                    state: "offline",
                })
            })
        }
    });

    // Handle WebRTC answer
    socket.on("sendAnswer", ({ receiverId, answer }) => {
        const otherUser = getUser(receiverId);
        if (otherUser) {
            otherUser.socketIds.forEach((socketId) => {
                io.to(socketId).emit("receiveAnswer", { answer });
            });
        }
    });

    // Handle ICE candidate exchange
    socket.on("sendIceCandidate", ({ receiverId, candidate }) => {
        const otherUser = getUser(receiverId);
        if (otherUser) {
            otherUser.socketIds.forEach((socketId) => {
                io.to(socketId).emit("receiveIceCandidate", { candidate });
            });
        }
    });

    socket.on("toggleCamera", ({receiverId, status}) => {
        const otherUser = getUser(receiverId);
        if (otherUser) {
          otherUser.socketIds.forEach((socketId) => {
            io.to(socketId).emit("toggleCamera", { status });
          });
        }
    })

    socket.on("endCall", ({ receiverId, senderId, status }) => {
        const otherUser = getUser(receiverId);
        if (otherUser) {
          otherUser.socketIds.forEach((socketId) => {
            io.to(socketId).emit("callEnded", { status, senderId });
          });
        }
    });

    
    // send and get message
    socket.on("sendMessage", ({senderId, receiverId, text, callType, callDuration, callInfo, fileUrl, fileType, fileName}) => {
        const otherUser = getUser(receiverId);
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("getMessage", {
                    senderId,
                    text,
                    fileUrl,
                    fileType,
                    fileName,
                    callType,
                    callDuration,
                    callInfo
                })
            })
        }
    })

    socket.on("seeMessage", ({senderId, receiverId, haveSeen}) => {
        const otherUser = getUser(receiverId);
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("haveSeenMessage", {
                    senderId,
                    haveSeen
                })
            })
        }
    })

    // update and get conversations
    socket.on("updateConversation", ({conversationOwner, receiverId, chatId, lastMessage}) => {
        const otherUser = getUser(conversationOwner);
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("getConversation", {
                    conversationOwner,
                    receiverId,
                    chatId,
                    lastMessage,
                    isSeen: false,
                })
            })
        }
    })

    // blocking users
    socket.on("blockUser", ({currentUserId, theBlockedOneId}) => {
        const currentUser = getUser(currentUserId);
        const otherUser = getUser(theBlockedOneId);

        currentUser.socketIds.forEach(socketId => {
            io.to(socketId).emit("getBlockedState", {
                state: "blockedByYou",
                theOtherUserId: theBlockedOneId
            })
        })
        
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("getBlockedState", {
                    state: "blockedByThem",
                    theOtherUserId: currentUserId
                })
            })
        }
    })

    // unBlocking users
    socket.on("unBlockUser", ({currentUserId, theBlockedOneId}) => {
        const currentUser = getUser(currentUserId);
        const otherUser = getUser(theBlockedOneId);

        currentUser.socketIds.forEach(socketId => {
            io.to(socketId).emit("getUnBlockedState", {
                state: "",
                theOtherUserId: theBlockedOneId
            })
        })
        
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("getUnBlockedState", {
                    state: "",
                    theOtherUserId: currentUserId
                })
            })
        }
    })

    // send and get notifications
    socket.on("sendNotification", (notification) => {
        const otherUser = getUser(notification.receiverId);
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("getNotification", {
                    authorId: notification.authorId,
                    postId: notification.postId,
                    content: notification.content
                })
            })
        }
    })

    // remove notification
    socket.on("removeNotification", (notification) => {
        const otherUser = getUser(notification.receiverId);
        if (otherUser){
            otherUser.socketIds.forEach(socketId => {
                io.to(socketId).emit("updateNotifications", {
                    authorId: notification.authorId,
                    postId: notification.postId,
                    forLikePurpose: notification.forLikePurpose,
                    friendRequest: notification.friendRequest,
                    content: notification.content
                })
            })
        }
    })

    
    // when disconnected
    socket.on("disconnect", () => {
        console.log("a user disconnected!")
        removeUser(socket.id)
        io.emit("getUsers", users);
    })
})
