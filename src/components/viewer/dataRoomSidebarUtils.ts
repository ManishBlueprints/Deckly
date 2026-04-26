import { DataRoomDocument } from "../../types";

export type DataRoomSidebarSection = {
  id: string;
  title: string;
  documents: DataRoomDocument[];
  icon: "documents" | "folder";
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
};

export function buildDataRoomSidebarSections(
  documents: DataRoomDocument[],
  folders: Array<{ id: string; name: string }>,
) {
  const docsByFolder = new Map<string, DataRoomDocument[]>();
  const folderOrder = folders.map((folder) => folder.id);
  const discoveredFolderOrder: string[] = [];

  documents.forEach((doc) => {
    const folderId = doc.folder_id || "unorganized";
    if (
      folderId !== "unorganized" &&
      !discoveredFolderOrder.includes(folderId)
    ) {
      discoveredFolderOrder.push(folderId);
    }

    const current = docsByFolder.get(folderId) || [];
    current.push(doc);
    docsByFolder.set(folderId, current);
  });

  const orderedFolderIds = [
    ...folderOrder.filter((folderId) => docsByFolder.has(folderId)),
    ...discoveredFolderOrder.filter(
      (folderId) => !folderOrder.includes(folderId),
    ),
  ];

  const sections: DataRoomSidebarSection[] = [];

  const unorganized = docsByFolder.get("unorganized");
  if (unorganized && unorganized.length > 0) {
    sections.push({
      id: "unorganized",
      title: "Documents",
      documents: unorganized,
      icon: "documents",
    });
  }

  orderedFolderIds.forEach((folderId) => {
    sections.push({
      id: folderId,
      title:
        folders.find((folder) => folder.id === folderId)?.name ||
        docsByFolder.get(folderId)?.[0]?.folder_name ||
        "Folder",
      documents: docsByFolder.get(folderId) || [],
      icon: "folder",
      collapsible: true,
    });
  });

  return sections;
}
