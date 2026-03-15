import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { swapAPI } from '../services/api.service';

export const useSwap = (swapId, params = {}) => {
  const queryClient = useQueryClient();

  const swapQuery = useQuery({
    queryKey: ['swap', swapId],
    queryFn: () => swapAPI.getSwapById(swapId),
    enabled: Boolean(swapId),
  });

  const swapsQuery = useQuery({
    queryKey: ['swaps', params],
    queryFn: () => swapAPI.getSwaps(params),
    staleTime: 30_000,
  });

  const activeSwapsQuery = useQuery({
    queryKey: ['active-swaps'],
    queryFn: () => swapAPI.getActiveSwaps(),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['swap-stats'],
    queryFn: () => swapAPI.getSwapStats(),
    staleTime: 60_000,
  });

  const upcomingSessionsQuery = useQuery({
    queryKey: ['upcoming-sessions'],
    queryFn: () => swapAPI.getUpcomingSessions(),
    staleTime: 30_000,
  });

  const createSwapMutation = useMutation({
    mutationFn: (payload) => swapAPI.createSwap(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap-stats'] }),
      ]);
    },
  });

  const acceptSwapMutation = useMutation({
    mutationFn: (id) => swapAPI.acceptSwap(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap-stats'] }),
      ]);
    },
  });

  const cancelSwapMutation = useMutation({
    mutationFn: ({ id, reason }) => swapAPI.cancelSwap(id, { reason }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap-stats'] }),
      ]);
    },
  });

  const completeSwapMutation = useMutation({
    mutationFn: (id) => swapAPI.confirmComplete(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap-stats'] }),
      ]);
    },
  });

  const scheduleSessionMutation = useMutation({
    mutationFn: ({ id, payload }) => swapAPI.scheduleSession(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey:['upcoming-sessions'] }),
      ]);
    },
  });

  const startSwapMutation = useMutation({
    mutationFn: (id) => swapAPI.startSwap(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swaps'] }),
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
      ]);
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (id) => swapAPI.markComplete(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['active-swaps'] }),
      ]);
    },
  });

  const rescheduleSessionMutation = useMutation({
    mutationFn: ({ id, sessionId, payload }) => swapAPI.rescheduleSession(id, sessionId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['swap', swapId] }),
        queryClient.invalidateQueries({ queryKey: ['upcoming-sessions'] }),
      ]);
    },
  });

  return {
    swap: swapQuery.data || null,
    swaps: swapsQuery.data?.data || swapsQuery.data?.swaps || (Array.isArray(swapsQuery.data) ? swapsQuery.data : []),
    activeSwaps: activeSwapsQuery.data?.swaps || (Array.isArray(activeSwapsQuery.data) ? activeSwapsQuery.data : []),
    swapStats: statsQuery.data || {},
    upcomingSessions: upcomingSessionsQuery.data?.sessions || (Array.isArray(upcomingSessionsQuery.data) ? upcomingSessionsQuery.data : []),
    isLoading: swapQuery.isLoading || swapsQuery.isLoading || activeSwapsQuery.isLoading || upcomingSessionsQuery.isLoading,
    error: swapQuery.error || swapsQuery.error || activeSwapsQuery.error,
    refetchSwap: swapQuery.refetch,
    refetchSwaps: swapsQuery.refetch,
    refetchActiveSwaps: activeSwapsQuery.refetch,
    createSwap: createSwapMutation.mutateAsync,
    acceptSwap: acceptSwapMutation.mutateAsync,
    cancelSwap: cancelSwapMutation.mutateAsync,
    confirmComplete: completeSwapMutation.mutateAsync,
    scheduleSession: scheduleSessionMutation.mutateAsync,
    startSwap: startSwapMutation.mutateAsync,
    markComplete: markCompleteMutation.mutateAsync,
    rescheduleSession: rescheduleSessionMutation.mutateAsync,
  };
};
