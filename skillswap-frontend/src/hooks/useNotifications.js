import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifAPI } from '../services/api.service';
import { useSocket } from '../contexts/SocketContext';
import { SOCKET_EVENTS } from '../constants/events';

export const useNotifications = (params = {}) => {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notifAPI.getNotifications(params),
    staleTime: 15_000,
  });

  const unreadCountQuery = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: () => notifAPI.getUnreadCount(),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!socket || !isConnected) return;
    const currentEvent = SOCKET_EVENTS.notificationCreated;
    const legacyEvent = 'notification:created';

    const handleNewNotification = (notification) => {
      // Optimistically update caches without a full refetch if you want,
      // or invalidate. Invalidation is safer, but updating cache is snappier.
      queryClient.setQueryData(['notification-unread-count'], (old) => {
        return { count: (old?.count || 0) + 1 };
      });

      queryClient.setQueryData(['notifications', params], (old) => {
        if (!old) return old;
        const notificationsList = Array.isArray(old)
          ? old
          : (old.notifications || old.items || []);
        const updatedList = [notification, ...notificationsList.filter(n => n.id !== notification.id)];
        if (Array.isArray(old)) return updatedList;
        return {
          ...old,
          notifications: updatedList,
          items: updatedList,
        };
      });
    };

    socket.on(currentEvent, handleNewNotification);
    if (legacyEvent !== currentEvent) {
      socket.on(legacyEvent, handleNewNotification);
    }

    return () => {
      socket.off(currentEvent, handleNewNotification);
      if (legacyEvent !== currentEvent) {
        socket.off(legacyEvent, handleNewNotification);
      }
    };
  }, [socket, isConnected, queryClient, params]);

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => notifAPI.markRead(notificationId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] }),
      ]);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notifAPI.markAllRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] }),
      ]);
    },
  });

  return {
    notifications: notificationsQuery.data?.notifications || notificationsQuery.data?.items || notificationsQuery.data || [],
    pagination: notificationsQuery.data?.pagination || null,
    unreadCount: unreadCountQuery.data?.count || 0,
    isLoading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
    error: notificationsQuery.error || unreadCountQuery.error,
    refetchNotifications: notificationsQuery.refetch,
    refetchUnreadCount: unreadCountQuery.refetch,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
  };
};
