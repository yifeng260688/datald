import { Server as SocketIOServer } from "socket.io";
import type { Server } from "http";
import type { IStorage } from "./storage";

let io: SocketIOServer | null = null;
let storageRef: IStorage | null = null;

const socketAuthorizedConversations = new Map<string, Set<string>>();

export function setupSocket(httpServer: Server, storage: IStorage) {
  storageRef = storage;
  
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socketAuthorizedConversations.set(socket.id, new Set());

    socket.on("join:conversation", async (conversationId: string) => {
      if (!conversationId || typeof conversationId !== "string") {
        console.log(`Socket ${socket.id} attempted to join invalid conversation`);
        return;
      }

      const conversation = await storageRef?.getConversationById(conversationId);
      if (!conversation) {
        console.log(`Socket ${socket.id} attempted to join non-existent conversation: ${conversationId}`);
        return;
      }

      const authorized = socketAuthorizedConversations.get(socket.id);
      if (authorized) {
        authorized.add(conversationId);
      }
      
      socket.join(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation:${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId: string) => {
      if (!conversationId || typeof conversationId !== "string") return;
      
      const authorized = socketAuthorizedConversations.get(socket.id);
      if (authorized) {
        authorized.delete(conversationId);
      }
      
      socket.leave(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} left conversation:${conversationId}`);
    });

    socket.on("join:admin", () => {
      socket.join("admin:support");
      console.log(`Socket ${socket.id} joined admin:support room`);
    });

    socket.on("disconnect", () => {
      socketAuthorizedConversations.delete(socket.id);
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitNewMessage(conversationId: string, message: any) {
  if (io) {
    io.to(`conversation:${conversationId}`).emit("message:new", message);
    io.to("admin:support").emit("message:new", { conversationId, message });
  }
}

export function emitConversationUpdate(conversation: any) {
  if (io) {
    io.to("admin:support").emit("conversation:update", conversation);
    if (conversation._id) {
      io.to(`conversation:${conversation._id}`).emit("conversation:update", conversation);
    }
  }
}
