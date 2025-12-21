import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Send, Minimize2, MessageCircle, User } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 417.75 445.5" 
      className={className}
      fill="currentColor"
    >
      <path d="M 352.167969 183.929688 L 354.042969 183.929688 C 361.550781 183.929688 367.789062 189.46875 368.878906 196.675781 C 370.007812 196.449219 371.148438 196.269531 372.296875 196.140625 C 368.550781 183.4375 363.628906 171.1875 357.625 159.628906 C 353.632812 151.9375 349.15625 144.550781 344.238281 137.519531 C 346.808594 131.785156 345.941406 125.253906 341.9375 120.398438 C 340.554688 118.714844 339.125 117.042969 337.699219 115.417969 C 303.382812 76.460938 257.585938 55.011719 208.746094 55.011719 C 159.910156 55.011719 114.117188 76.460938 79.804688 115.417969 C 78.375 117.042969 76.949219 118.714844 75.566406 120.390625 C 71.558594 125.253906 70.695312 131.785156 73.261719 137.519531 C 68.34375 144.550781 63.863281 151.9375 59.867188 159.628906 C 53.863281 171.1875 48.945312 183.433594 45.195312 196.136719 C 46.347656 196.269531 47.488281 196.445312 48.621094 196.675781 C 49.714844 189.46875 55.953125 183.929688 63.457031 183.929688 L 65.332031 183.929688 C 70.613281 170.613281 77.222656 158.222656 84.960938 146.957031 C 86.046875 147.175781 87.164062 147.292969 88.308594 147.292969 C 93.246094 147.292969 97.886719 145.097656 101.042969 141.265625 C 118.691406 119.84375 140.953125 103.972656 165.421875 95.363281 C 179.394531 90.4375 193.972656 87.9375 208.746094 87.9375 C 249.1875 87.9375 288.445312 107.394531 316.445312 141.316406 C 319.582031 145.117188 324.207031 147.292969 329.136719 147.292969 L 329.191406 147.292969 C 330.335938 147.292969 331.453125 147.175781 332.535156 146.957031 C 340.242188 158.179688 346.863281 170.554688 352.167969 183.929688"/>
      <path d="M 213.269531 421.035156 L 213.265625 421.023438 C 210.476562 416.015625 205.175781 412.90625 199.4375 412.90625 C 194.34375 412.90625 189.53125 415.382812 186.566406 419.527344 L 184.621094 422.246094 L 181.335938 421.625 C 152.601562 416.179688 125.335938 401.695312 102.484375 379.742188 C 88.757812 366.5625 77.058594 351.195312 67.683594 334.023438 L 63.457031 334.023438 C 61.613281 334.023438 59.851562 333.652344 58.246094 332.980469 C 61.753906 339.824219 65.621094 346.4375 69.824219 352.765625 C 77.746094 364.695312 86.902344 375.679688 97.039062 385.414062 C 109.113281 397.007812 122.371094 406.652344 136.441406 414.074219 C 150.382812 421.429688 165.089844 426.589844 180.160156 429.410156 L 183.339844 430.003906 L 184.226562 433.113281 C 186.15625 439.859375 192.410156 444.570312 199.4375 444.570312 C 205.882812 444.570312 211.628906 440.722656 214.074219 434.769531 C 214.871094 432.847656 215.273438 430.820312 215.273438 428.738281 C 215.273438 426.035156 214.582031 423.375 213.273438 421.042969 L 213.269531 421.035156"/>
      <path d="M 64.46875 328.78125 C 65.574219 328.78125 66.480469 327.875 66.480469 326.769531 L 66.480469 191.101562 C 66.480469 189.992188 65.574219 189.085938 64.464844 189.085938 L 63.34375 189.085938 C 56.4375 189.085938 50.785156 194.738281 50.785156 201.644531 C 47.394531 200.023438 43.625 199.0625 39.640625 198.941406 C 39.261719 198.929688 38.886719 198.921875 38.511719 198.921875 C 37.441406 198.921875 36.378906 198.96875 35.328125 199.0625 C 19.664062 200.421875 6.601562 211.71875 2.777344 226.71875 C 2.125 229.273438 1.738281 231.933594 1.65625 234.667969 L 0.230469 281.21875 C 0.214844 281.695312 0.214844 282.167969 0.214844 282.640625 C 0.367188 302.277344 16.167969 318.59375 35.964844 319.195312 C 36.148438 319.203125 36.339844 319.203125 36.523438 319.203125 C 43.25 319.203125 49.378906 316.574219 53.878906 312.25 C 54.910156 320.574219 62.015625 327.015625 70.617188 327.015625 L 97.53125 327.015625 C 106.984375 327.015625 114.65625 319.34375 114.65625 309.890625 L 114.65625 206.910156 C 114.65625 197.457031 106.984375 189.785156 97.53125 189.785156 L 83.925781 189.785156 L 83.925781 189.085938 L 63.457031 189.085938 C 56.550781 189.085938 50.898438 194.738281 50.898438 201.644531 L 50.898438 303.082031 C 50.898438 305.082031 51.285156 306.988281 51.976562 308.75 C 48.226562 311.640625 43.378906 313.359375 38.125 313.359375 C 25.386719 313.359375 14.964844 303.25 14.640625 290.515625 L 14.640625 227.539062 C 14.726562 214.777344 25.167969 204.398438 37.988281 204.398438 L 50.785156 204.398438 C 53.796875 204.398438 56.234375 206.835938 56.234375 209.847656 L 56.234375 308.089844 C 56.234375 311.101562 58.671875 313.539062 61.683594 313.539062 L 100.078125 313.539062 L 100.078125 206.910156 C 100.078125 205.449219 98.898438 204.269531 97.4375 204.269531 L 81.40625 204.269531 C 79.945312 204.269531 78.765625 205.449219 78.765625 206.910156 L 78.765625 299.144531 L 71.5625 299.144531 L 71.5625 206.910156 C 71.5625 201.464844 75.96875 197.058594 81.40625 197.058594 L 97.4375 197.058594 C 102.882812 197.058594 107.289062 201.464844 107.289062 206.910156 L 107.289062 309.296875 L 108.507812 309.296875 L 108.507812 206.910156 C 108.507812 200.792969 103.550781 195.835938 97.4375 195.835938 L 81.40625 195.835938 C 75.292969 195.835938 70.332031 200.792969 70.332031 206.910156 L 70.332031 300.371094 L 69.410156 300.371094 L 69.441406 206.910156 C 69.441406 200.296875 74.796875 194.9375 81.40625 194.9375 L 97.4375 194.9375 C 104.050781 194.9375 109.40625 200.296875 109.40625 206.910156 L 109.40625 308.296875 L 109.757812 308.296875 C 109.757812 319.328125 100.953125 328.132812 89.921875 328.132812 L 64.46875 328.78125"/>
      <path d="M 352.03125 328.78125 C 350.925781 328.78125 350.019531 327.875 350.019531 326.769531 L 350.019531 191.101562 C 350.019531 189.992188 350.925781 189.085938 352.035156 189.085938 L 353.15625 189.085938 C 360.0625 189.085938 365.714844 194.738281 365.714844 201.644531 C 369.105469 200.023438 372.875 199.0625 376.859375 198.941406 C 377.238281 198.929688 377.613281 198.921875 377.988281 198.921875 C 379.058594 198.921875 380.121094 198.96875 381.171875 199.0625 C 396.835938 200.421875 409.898438 211.71875 413.722656 226.71875 C 414.375 229.273438 414.761719 231.933594 414.84375 234.667969 L 416.269531 281.21875 C 416.285156 281.695312 416.285156 282.167969 416.285156 282.640625 C 416.132812 302.277344 400.332031 318.59375 380.535156 319.195312 C 380.351562 319.203125 380.160156 319.203125 379.976562 319.203125 C 373.25 319.203125 367.121094 316.574219 362.621094 312.25 C 361.589844 320.574219 354.484375 327.015625 345.882812 327.015625 L 318.96875 327.015625 C 309.515625 327.015625 301.84375 319.34375 301.84375 309.890625 L 301.84375 206.910156 C 301.84375 197.457031 309.515625 189.785156 318.96875 189.785156 L 332.574219 189.785156 L 332.574219 189.085938 L 353.042969 189.085938 C 359.949219 189.085938 365.601562 194.738281 365.601562 201.644531 L 365.601562 303.082031 C 365.601562 305.082031 365.214844 306.988281 364.523438 308.75 C 368.273438 311.640625 373.121094 313.359375 378.375 313.359375 C 391.113281 313.359375 401.535156 303.25 401.859375 290.515625 L 401.859375 227.539062 C 401.773438 214.777344 391.332031 204.398438 378.511719 204.398438 L 365.714844 204.398438 C 362.703125 204.398438 360.265625 206.835938 360.265625 209.847656 L 360.265625 308.089844 C 360.265625 311.101562 357.828125 313.539062 354.816406 313.539062 L 316.421875 313.539062 L 316.421875 206.910156 C 316.421875 205.449219 317.601562 204.269531 319.0625 204.269531 L 335.09375 204.269531 C 336.554688 204.269531 337.734375 205.449219 337.734375 206.910156 L 337.734375 299.144531 L 344.9375 299.144531 L 344.9375 206.910156 C 344.9375 201.464844 340.53125 197.058594 335.09375 197.058594 L 319.0625 197.058594 C 313.617188 197.058594 309.210938 201.464844 309.210938 206.910156 L 309.210938 309.296875 L 307.992188 309.296875 L 307.992188 206.910156 C 307.992188 200.792969 312.949219 195.835938 319.0625 195.835938 L 335.09375 195.835938 C 341.207031 195.835938 346.167969 200.792969 346.167969 206.910156 L 346.167969 300.371094 L 347.089844 300.371094 L 347.058594 206.910156 C 347.058594 200.296875 341.703125 194.9375 335.09375 194.9375 L 319.0625 194.9375 C 312.449219 194.9375 307.09375 200.296875 307.09375 206.910156 L 307.09375 308.296875 L 306.742188 308.296875 C 306.742188 319.328125 315.546875 328.132812 326.578125 328.132812 L 352.03125 328.78125"/>
      <path d="M 285.402344 197.179688 L 285.402344 335.226562 C 285.402344 345.375 277.164062 353.613281 267.015625 353.613281 L 149.703125 353.613281 C 139.554688 353.613281 131.316406 345.375 131.316406 335.226562 L 131.316406 197.179688 C 131.316406 187.03125 139.554688 178.792969 149.703125 178.792969 L 267.015625 178.792969 C 277.164062 178.792969 285.402344 187.03125 285.402344 197.179688 Z M 285.402344 197.179688"/>
      <path fill="#ffffff" d="M 278.621094 197.179688 L 278.621094 335.226562 C 278.621094 341.628906 273.417969 346.832031 267.015625 346.832031 L 149.703125 346.832031 C 143.300781 346.832031 138.097656 341.628906 138.097656 335.226562 L 138.097656 197.179688 C 138.097656 190.777344 143.300781 185.574219 149.703125 185.574219 L 267.015625 185.574219 C 273.417969 185.574219 278.621094 190.777344 278.621094 197.179688 Z M 278.621094 197.179688"/>
      <path d="M 253.179688 217.972656 L 163.542969 217.972656 C 159.730469 217.972656 156.632812 214.875 156.632812 211.0625 C 156.632812 207.25 159.730469 204.152344 163.542969 204.152344 L 253.179688 204.152344 C 256.992188 204.152344 260.089844 207.25 260.089844 211.0625 C 260.089844 214.875 256.992188 217.972656 253.179688 217.972656 Z M 253.179688 217.972656"/>
      <path d="M 253.179688 247.386719 L 163.542969 247.386719 C 159.730469 247.386719 156.632812 244.289062 156.632812 240.476562 C 156.632812 236.664062 159.730469 233.566406 163.542969 233.566406 L 253.179688 233.566406 C 256.992188 233.566406 260.089844 236.664062 260.089844 240.476562 C 260.089844 244.289062 256.992188 247.386719 253.179688 247.386719 Z M 253.179688 247.386719"/>
      <path d="M 253.179688 276.796875 L 163.542969 276.796875 C 159.730469 276.796875 156.632812 273.699219 156.632812 269.886719 C 156.632812 266.078125 159.730469 262.980469 163.542969 262.980469 L 253.179688 262.980469 C 256.992188 262.980469 260.089844 266.078125 260.089844 269.886719 C 260.089844 273.699219 256.992188 276.796875 253.179688 276.796875 Z M 253.179688 276.796875"/>
      <path d="M 222.390625 306.210938 L 163.542969 306.210938 C 159.730469 306.210938 156.632812 303.113281 156.632812 299.300781 C 156.632812 295.488281 159.730469 292.390625 163.542969 292.390625 L 222.390625 292.390625 C 226.203125 292.390625 229.300781 295.488281 229.300781 299.300781 C 229.300781 303.113281 226.203125 306.210938 222.390625 306.210938 Z M 222.390625 306.210938"/>
      <path d="M 197.074219 82.875 C 201.476562 82.875 205.042969 79.304688 205.042969 74.90625 L 205.042969 30.964844 C 205.042969 26.5625 201.476562 22.996094 197.074219 22.996094 C 192.675781 22.996094 189.105469 26.5625 189.105469 30.964844 L 189.105469 74.90625 C 189.105469 79.304688 192.675781 82.875 197.074219 82.875 Z M 197.074219 82.875"/>
      <path d="M 139.449219 95.160156 C 142.515625 98.222656 147.542969 98.222656 150.601562 95.160156 C 153.664062 92.097656 153.664062 87.070312 150.601562 84.011719 L 119.464844 52.875 C 116.402344 49.8125 111.375 49.8125 108.316406 52.875 C 105.253906 55.9375 105.253906 60.964844 108.316406 64.023438 Z M 139.449219 95.160156"/>
      <path d="M 266.179688 95.160156 L 297.320312 64.023438 C 300.378906 60.960938 300.378906 55.933594 297.320312 52.875 C 294.257812 49.8125 289.230469 49.8125 286.171875 52.875 L 255.03125 84.011719 C 251.96875 87.074219 251.96875 92.101562 255.03125 95.160156 C 258.09375 98.21875 263.121094 98.21875 266.179688 95.160156 Z M 266.179688 95.160156"/>
      <path d="M 333.929688 109.433594 C 341.886719 101.476562 341.886719 88.519531 333.929688 80.5625 L 330.617188 77.246094 C 322.65625 69.289062 309.703125 69.289062 301.746094 77.246094 C 293.785156 85.207031 293.785156 98.160156 301.746094 106.117188 L 305.058594 109.433594 C 313.015625 117.390625 325.972656 117.390625 333.929688 109.433594 Z M 333.929688 109.433594"/>
      <path d="M 83.746094 109.433594 L 87.0625 106.117188 C 95.019531 98.160156 95.019531 85.207031 87.0625 77.246094 C 79.101562 69.289062 66.148438 69.289062 58.191406 77.246094 L 54.878906 80.5625 C 46.921875 88.519531 46.921875 101.476562 54.878906 109.433594 C 62.835938 117.390625 75.792969 117.390625 83.746094 109.433594 Z M 83.746094 109.433594"/>
    </svg>
  );
}

interface Message {
  _id: string;
  id: string;
  conversationId: string;
  senderType: "user" | "admin" | "system";
  senderId?: string;
  senderName?: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Conversation {
  _id: string;
  id: string;
  userId?: string;
  guestId?: string;
  status: "active" | "closed";
  unreadByUser: number;
  lastMessageAt: string;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

export function ChatWidget({ isOpen, onClose, onMinimize }: ChatWidgetProps) {
  const [message, setMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, isAuthenticated } = useAuth();

  const { data: conversation, isLoading: isLoadingConversation } = useQuery<Conversation>({
    queryKey: ["/api/support/conversation"],
    enabled: isOpen,
    retry: false,
  });

  const { data: fetchedMessages = [] } = useQuery<Message[]>({
    queryKey: ["/api/support/conversation", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: isOpen ? 3000 : false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/support/conversation/${conversationId}/messages`, { content });
      return response.json();
    },
    onSuccess: (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      setMessage("");
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/support/conversation", {});
      return response.json();
    },
    onSuccess: (conv) => {
      setConversationId(conv._id || conv.id);
      queryClient.invalidateQueries({ queryKey: ["/api/support/conversation"] });
    },
  });

  useEffect(() => {
    if (conversation) {
      setConversationId(conversation._id || conversation.id);
    }
  }, [conversation]);

  useEffect(() => {
    if (fetchedMessages.length > 0) {
      setMessages(fetchedMessages);
    }
  }, [fetchedMessages]);

  useEffect(() => {
    if (isOpen && conversationId) {
      const newSocket = io({
        path: "/socket.io",
        transports: ["websocket", "polling"],
      });

      newSocket.on("connect", () => {
        console.log("Chat socket connected");
        newSocket.emit("join:conversation", conversationId);
      });

      newSocket.on("message:new", (newMessage: Message) => {
        if (newMessage.senderType === "admin") {
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === newMessage._id || m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.emit("leave:conversation", conversationId);
        newSocket.disconnect();
      };
    }
  }, [isOpen, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!conversationId) {
      createConversationMutation.mutate();
      return;
    }

    sendMessageMutation.mutate(message.trim());
  };

  const handleStartChat = () => {
    createConversationMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-20 right-4 w-80 sm:w-96 h-[500px] flex flex-col shadow-2xl z-50" data-testid="chat-widget">
      <CardHeader className="flex flex-col gap-1 py-3 px-4 border-b bg-primary text-primary-foreground rounded-t-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <CardTitle className="text-base font-medium">Hỗ trợ trực tuyến</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onMinimize}
              data-testid="button-minimize-chat"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={onClose}
              data-testid="button-close-chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary-foreground/80" data-testid="chat-user-info">
          <User className="w-3 h-3" />
          <span>{isAuthenticated && user?.email ? user.email : "Khách"}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {isLoadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Đang tải...</p>
            </div>
          ) : !conversationId ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground" />
              <div>
                <p className="font-medium mb-2">Chào mừng bạn!</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Hãy bắt đầu cuộc trò chuyện với bộ phận hỗ trợ của chúng tôi.
                </p>
                <Button onClick={handleStartChat} data-testid="button-start-chat">
                  Bắt đầu chat
                </Button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">
                Chưa có tin nhắn. Hãy gửi tin nhắn đầu tiên!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg._id || msg.id}
                  className={cn(
                    "flex",
                    msg.senderType === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2",
                      msg.senderType === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.senderType === "admin"
                        ? "bg-muted"
                        : "bg-accent text-accent-foreground text-center text-sm"
                    )}
                  >
                    {msg.senderType !== "user" && msg.senderName && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {msg.senderName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      msg.senderType === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {conversationId && (
        <CardFooter className="p-3 border-t">
          <form onSubmit={handleSendMessage} className="flex w-full gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="flex-1"
              disabled={sendMessageMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!message.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardFooter>
      )}
    </Card>
  );
}

const blinkingStyle = `
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
`;

export function ChatLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["/api/support/conversation"],
    retry: false,
    refetchInterval: isOpen ? false : 30000,
  });

  useEffect(() => {
    if (conversation && !isOpen) {
      setUnreadCount(conversation.unreadByUser || 0);
    }
  }, [conversation, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsOpen(false);
    setIsMinimized(true);
  };

  return (
    <>
      <style>{blinkingStyle}</style>
      <ChatWidget isOpen={isOpen} onClose={handleClose} onMinimize={handleMinimize} />
      
      {!isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span
            style={{
              backgroundColor: '#78d2f0',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              animation: 'blink 1.5s infinite',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
            data-testid="text-contact-label"
          >
            Liên hệ
          </span>
          <button
            onClick={handleOpen}
            style={{
              position: 'relative',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#78d2f0',
              color: '#fff400',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            data-testid="button-chat-launcher"
          >
            <ChatIcon className="w-8 h-8" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
    </>
  );
}
