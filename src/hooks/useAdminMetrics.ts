import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/userService";

export function useAdminMetrics(isAdmin: boolean) {
  const query = useQuery({
    queryKey: ["admin-total-users"],
    queryFn: async () => {
      return await userService.getTotalUsers();
    },
    enabled: isAdmin, // Only run the query if the user is historically recognized as an admin
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    totalUsers: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
