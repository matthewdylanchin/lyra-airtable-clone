import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

export function useViews(tableId: string) {
  return useQuery({
    queryKey: ["views", tableId],
    queryFn: async () => {
      const res = await axios.get(`/api/views?tableId=${tableId}`);
      return res.data;
    },
  });
}

export function useCreateView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tableId,
      name,
    }: {
      tableId: string;
      name: string;
    }) => {
      const res = await axios.post("/api/views/create", { tableId, name });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["views", variables.tableId] });
    },
  });
}
