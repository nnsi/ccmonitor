import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Session {
  id: string;
  cwd: string;
  status: 'running' | 'waiting' | 'completed';
  createdAt: string;
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: async (): Promise<Session[]> => {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      return data.sessions;
    }
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cwd: string) => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd })
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] })
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] })
  });
}
