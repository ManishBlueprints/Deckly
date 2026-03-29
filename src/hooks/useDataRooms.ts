import { useQuery, useMutation } from "@tanstack/react-query";
import { dataRoomService } from "../services/dataRoomService";
import { DataRoom } from "../types";

// Optimized caching config for data room queries
const DATA_ROOM_QUERY_CONFIG = {
  staleTime: 30000, // 30 seconds - data is considered fresh
  gcTime: 300000, // 5 minutes cache retention
} as const;

export function useDataRooms() {
  return useQuery({
    queryKey: ["data-rooms"],
    queryFn: () => dataRoomService.getDataRooms(),
    ...DATA_ROOM_QUERY_CONFIG,
  });
}

export function useDataRoomMeta(roomId: string) {
  return useQuery({
    queryKey: ["data-room-meta", roomId],
    queryFn: async () => {
      const [docCount, analytics] = await Promise.all([
        dataRoomService.getDocumentCount(roomId),
        dataRoomService.getDataRoomAnalytics(roomId),
      ]);
      return { docCount, visitors: analytics.totalVisitors };
    },
    enabled: !!roomId,
    ...DATA_ROOM_QUERY_CONFIG,
  });
}

export function useDataRoomsWithMeta() {
  return useQuery({
    queryKey: ["data-rooms", "with-meta"],
    queryFn: async () => {
      const rooms = await dataRoomService.getDataRooms();
      
      // Try batch RPC first (single API call instead of N+1)
      try {
        const batchAnalytics = await dataRoomService.getBatchDataRoomAnalytics(
          rooms.map((r: DataRoom) => r.id)
        );

        return rooms.map((room: DataRoom) => ({
          ...room,
          docCount: batchAnalytics.get(room.id)?.docCount ?? 0,
          visitors: batchAnalytics.get(room.id)?.visitors ?? 0,
        }));
      } catch {
        // Fallback to individual calls if batch fails
        console.warn("Batch analytics failed, using individual calls");
        const richRooms = await Promise.all(
          rooms.map(async (room: DataRoom) => {
            const [docCount, analytics] = await Promise.all([
              dataRoomService.getDocumentCount(room.id),
              dataRoomService.getDataRoomAnalytics(room.id),
            ]);
            return {
              ...room,
              docCount,
              visitors: analytics.totalVisitors,
            };
          })
        );
        return richRooms;
      }
    },
    ...DATA_ROOM_QUERY_CONFIG,
  });
}

export function useDataRoomDocuments(roomId: string) {
  return useQuery({
    queryKey: ["data-room-documents", roomId],
    queryFn: () => dataRoomService.getDocuments(roomId),
    enabled: !!roomId,
    ...DATA_ROOM_QUERY_CONFIG,
  });
}

export function useDataRoomSlug(slug: string) {
  return useQuery({
    queryKey: ["data-room-slug", slug],
    queryFn: () => dataRoomService.getDataRoomBySlugOnly(slug),
    enabled: !!slug,
    ...DATA_ROOM_QUERY_CONFIG,
  });
}

export function useCheckDataRoomPassword() {
  return useMutation({
    mutationFn: ({ slug, password }: { slug: string; password: string }) =>
      dataRoomService.checkDataRoomPassword(slug, password),
  });
}
