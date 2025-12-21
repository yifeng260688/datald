import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageCircle, 
  Send, 
  User as UserIcon, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  guestName?: string;
  guestEmail?: string;
  userName?: string;
  userEmail?: string;
  status: "active" | "closed";
  unreadByAdmin: number;
  unreadByUser: number;
  lastMessageAt: string;
  lastMessagePreview?: string;
  createdAt: string;
}

export default function Support() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: conversations = [], isLoading: isLoadingConversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/support/conversations"],
  });

  const { data: fetchedMessages = [], isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/admin/support/conversations", selectedConversation?._id, "messages"],
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(
        "POST",
        `/api/admin/support/conversations/${selectedConversation?._id}/messages`,
        { content }
      );
      return response.json();
    },
    onSuccess: (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
      setNewMessage("");
      refetchConversations();
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Không thể gửi tin nhắn",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest("POST", `/api/admin/support/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      refetchConversations();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "closed" }) => {
      const response = await apiRequest("PATCH", `/api/admin/support/conversations/${id}`, { status });
      return response.json();
    },
    onSuccess: (updatedConv) => {
      setSelectedConversation(updatedConv);
      refetchConversations();
      toast({
        title: "Thành công",
        description: `Cuộc trò chuyện đã được ${updatedConv.status === "closed" ? "đóng" : "mở lại"}`,
      });
    },
  });

  useEffect(() => {
    if (fetchedMessages.length > 0) {
      setMessages(fetchedMessages);
    } else {
      setMessages([]);
    }
  }, [fetchedMessages]);

  useEffect(() => {
    const newSocket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("Admin socket connected");
      newSocket.emit("join:admin");
    });

    newSocket.on("message:new", (data: { conversationId?: string; message?: Message } & Message) => {
      const message = data.message || data;
      const convId = data.conversationId || message.conversationId;

      if (selectedConversation && (selectedConversation._id === convId || selectedConversation.id === convId)) {
        if (message.senderType === "user") {
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === message._id || m.id === message.id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
      }
      
      refetchConversations();
    });

    newSocket.on("conversation:update", () => {
      refetchConversations();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedConversation && inputRef.current) {
      inputRef.current.focus();
      if (selectedConversation.unreadByAdmin > 0) {
        markAsReadMutation.mutate(selectedConversation._id);
      }
    }
  }, [selectedConversation]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setMessages([]);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Hôm qua";
    } else if (days < 7) {
      return `${days} ngày trước`;
    } else {
      return date.toLocaleDateString("vi-VN");
    }
  };

  const activeConversations = conversations.filter((c) => c.status === "active");
  const closedConversations = conversations.filter((c) => c.status === "closed");

  return (
    <div className="h-[calc(100vh-64px)] flex" data-testid="admin-support-page">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg" data-testid="heading-conversations">Cuộc trò chuyện</h2>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => refetchConversations()}
              data-testid="button-refresh-conversations"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {activeConversations.length} đang hoạt động
          </p>
        </div>

        <ScrollArea className="flex-1">
          {isLoadingConversations ? (
            <div className="p-4 text-center text-muted-foreground">Đang tải...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có cuộc trò chuyện nào</p>
            </div>
          ) : (
            <div className="divide-y">
              {activeConversations.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">ĐANG HOẠT ĐỘNG</span>
                  </div>
                  {activeConversations.map((conv) => (
                    <ConversationItem
                      key={conv._id}
                      conversation={conv}
                      isSelected={selectedConversation?._id === conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      formatTime={formatTime}
                    />
                  ))}
                </>
              )}
              
              {closedConversations.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-muted/50">
                    <span className="text-xs font-medium text-muted-foreground">ĐÃ ĐÓNG</span>
                  </div>
                  {closedConversations.map((conv) => (
                    <ConversationItem
                      key={conv._id}
                      conversation={conv}
                      isSelected={selectedConversation?._id === conv._id}
                      onClick={() => handleSelectConversation(conv)}
                      formatTime={formatTime}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium" data-testid="text-user-name">
                    {selectedConversation.userName || selectedConversation.guestName || "Khách"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.userEmail || selectedConversation.guestEmail || "Không có email"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedConversation.status === "active" ? "default" : "secondary"}>
                  {selectedConversation.status === "active" ? "Đang hoạt động" : "Đã đóng"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatusMutation.mutate({
                    id: selectedConversation._id,
                    status: selectedConversation.status === "active" ? "closed" : "active",
                  })}
                  data-testid="button-toggle-status"
                >
                  {selectedConversation.status === "active" ? (
                    <>
                      <XCircle className="w-4 h-4 mr-1" />
                      Đóng
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mở lại
                    </>
                  )}
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Đang tải tin nhắn...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Chưa có tin nhắn</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg._id || msg.id}
                      className={cn(
                        "flex",
                        msg.senderType === "admin" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-3 py-2",
                          msg.senderType === "admin"
                            ? "bg-primary text-primary-foreground"
                            : msg.senderType === "user"
                            ? "bg-muted"
                            : "bg-accent text-accent-foreground text-center text-sm"
                        )}
                      >
                        {msg.senderType !== "admin" && msg.senderName && (
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          msg.senderType === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
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

            <div className="p-4 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nhập tin nhắn trả lời..."
                  disabled={selectedConversation.status === "closed" || sendMessageMutation.isPending}
                  data-testid="input-admin-message"
                />
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || selectedConversation.status === "closed" || sendMessageMutation.isPending}
                  data-testid="button-admin-send"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Gửi
                </Button>
              </form>
              {selectedConversation.status === "closed" && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Cuộc trò chuyện đã đóng. Mở lại để tiếp tục trả lời.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Chọn cuộc trò chuyện</h3>
            <p className="text-muted-foreground max-w-sm">
              Chọn một cuộc trò chuyện từ danh sách bên trái để xem và trả lời tin nhắn
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  formatTime,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (date: string) => string;
}) {
  return (
    <div
      className={cn(
        "p-3 cursor-pointer hover-elevate",
        isSelected && "bg-accent"
      )}
      onClick={onClick}
      data-testid={`conversation-item-${conversation._id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <UserIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">
              {conversation.userName || conversation.guestName || "Khách"}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatTime(conversation.lastMessageAt)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {conversation.lastMessagePreview || "Chưa có tin nhắn"}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {conversation.unreadByAdmin > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {conversation.unreadByAdmin}
              </Badge>
            )}
            {conversation.status === "closed" && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                Đã đóng
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
