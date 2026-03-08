import { useQuery } from "@tanstack/react-query";
import { dataRoomService } from "../services/dataRoomService";

export function useDataRooms() {
    return useQuery({
        queryKey: ["data-rooms"],
        queryFn: () => dataRoomService.getDataRooms(),
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
    });
}

export function useDataRoomsWithMeta() {
    return useQuery({
        queryKey: ["data-rooms", "with-meta"],
        queryFn: async () => {
            const rooms = await dataRoomService.getDataRooms();
            const richRooms = await Promise.all(
                rooms.map(async (room) => {
                    const [docCount, analytics] = await Promise.all([
                        dataRoomService.getDocumentCount(room.id),
                        dataRoomService.getDataRoomAnalytics(room.id),
                    ]);
                    return {
                        ...room,
                        docCount,
                        visitors: analytics.totalVisitors,
                    };
                }),
            );
            return richRooms;
        },
    });
}
