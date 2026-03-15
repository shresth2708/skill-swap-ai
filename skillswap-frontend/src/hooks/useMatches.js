import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchAPI } from '../services/api.service';

export const useMatches = (params = {}) => {
  const queryClient = useQueryClient();

  const matchesQuery = useQuery({
    queryKey: ['matches', params],
    queryFn: () => matchAPI.getMatches(params),
    staleTime: 30_000,
  });

  const statsQuery = useQuery({
    queryKey: ['match-stats'],
    queryFn: () => matchAPI.getStats(),
    staleTime: 60_000,
  });

  const acceptMutation = useMutation({
    mutationFn: (matchId) => matchAPI.acceptMatch(matchId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
        queryClient.invalidateQueries({ queryKey: ['match-stats'] }),
      ]);
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ matchId }) => matchAPI.declineMatch(matchId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
        queryClient.invalidateQueries({ queryKey: ['match-stats'] }),
      ]);
    },
  });

  return {
    matches: matchesQuery.data?.matches || matchesQuery.data || [],
    pagination: matchesQuery.data?.pagination || null,
    meta: matchesQuery.data?.meta || null,
    stats: statsQuery.data || {},
    // List should not wait on global stats; fixes empty grid stuck behind stats loading
    isLoading: matchesQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,
    isFetching: matchesQuery.isFetching || statsQuery.isFetching,
    error: matchesQuery.error || statsQuery.error,
    refetchMatches: matchesQuery.refetch,
    refetchStats: statsQuery.refetch,
    acceptMatch: acceptMutation.mutateAsync,
    declineMatch: declineMutation.mutateAsync,
    acceptStatus: acceptMutation.status,
    declineStatus: declineMutation.status,
  };
};
