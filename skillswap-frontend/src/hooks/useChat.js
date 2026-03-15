import { useEffect, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatAPI } from '../services/api.service';
import { useSocket } from '../contexts/SocketContext';
import { SOCKET_EVENTS } from '../constants/events';
import { useAuth } from './useAuth';

export const useChat = (swapId) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState({}); // { [userId]: boolean }

  const messagesQuery = useQuery({
    queryKey: ['chat-messages', swapId],
    queryFn: () => chatAPI.getMessages(swapId),
    enabled: Boolean(swapId),
    staleTime: 10_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: ['chat-unread-count'],
    queryFn: () => chatAPI.getUnreadCount(),
    staleTime: 10_000,
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId) => chatAPI.deleteMessage(swapId, messageId),
    onSuccess: async (data, messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
  });

  // Hydrate local messages state when query completes
  useEffect(() => {
    if (messagesQuery.data) {
      const nextMessages = Array.isArray(messagesQuery.data)
        ? messagesQuery.data
        : (messagesQuery.data?.messages || []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(nextMessages);
    }
  }, [messagesQuery.data]);

  useEffect(() => {
    if (!socket || !isConnected || !swapId) return;

    socket.emit('chat:join', { swapId });

    const handleMessage = (message) => {
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Mark as read immediately if chat is open
      if (message.senderId !== user?.id) {
        socket.emit('chat:read', { swapId });
      }
    };

    const handleTyping = ({ userId }) => {
      setIsTyping((prev) => ({ ...prev, [userId]: true }));
      // Clear typing after 5 seconds
      setTimeout(() => {
        setIsTyping((prev) => ({ ...prev, [userId]: false }));
      }, 5000);
    };

    const handleReadReceipt = ({ userId, readAt }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.senderId !== userId ? { ...msg, readAt } : msg
        )
      );
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read-receipt', handleReadReceipt);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read-receipt', handleReadReceipt);
      socket.emit('chat:leave', { swapId });
    };
  }, [socket, isConnected, swapId, user?.id]);

  const sendMessage = useCallback((content, msgType = 'TEXT') => {
    if (!socket || !isConnected || !swapId) return;
    socket.emit('chat:message', { swapId, content, msgType });
  }, [socket, isConnected, swapId]);

  const sendTyping = useCallback(() => {
    if (!socket || !isConnected || !swapId) return;
    socket.emit('chat:typing', { swapId });
  }, [socket, isConnected, swapId]);

  return {
    messages,
    isTyping,
    unreadCount: unreadCountQuery.data?.count || 0,
    isLoading: messagesQuery.isLoading || unreadCountQuery.isLoading,
    error: messagesQuery.error || unreadCountQuery.error,
    refetchMessages: messagesQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
    sendMessage,
    sendTyping,
    deleteMessage: deleteMessageMutation.mutateAsync,
    isDeleting: deleteMessageMutation.isPending,
  };
};
