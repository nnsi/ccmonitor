import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionHistory } from '@ccmonitor/shared';

export function useHistory() {
  return useQuery({
    queryKey: ['history'],
    queryFn: async (): Promise<SessionHistory[]> => {
      const res = await fetch('/api/history');
      const data = await res.json();
      return data.history;
    }
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch('/api/history', { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['history'] })
  });
}
