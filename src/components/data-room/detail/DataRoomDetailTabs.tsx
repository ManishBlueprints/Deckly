import { cn } from "@/lib/utils";

export type DataRoomDetailTab = "content" | "analytics" | "settings";

interface DataRoomDetailTabsProps {
  activeTab: DataRoomDetailTab;
  onChange: (tab: DataRoomDetailTab) => void;
}

export function DataRoomDetailTabs({
  activeTab,
  onChange,
}: DataRoomDetailTabsProps) {
  const tabs: { key: DataRoomDetailTab; label: string }[] = [
    { key: "content", label: "Content" },
    { key: "analytics", label: "Analytics" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-5 overflow-x-auto whitespace-nowrap px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative py-3 text-sm font-semibold transition-colors shrink-0",
              activeTab === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "absolute left-0 right-0 -bottom-px h-0.5 bg-primary transition-opacity",
                activeTab === tab.key ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
