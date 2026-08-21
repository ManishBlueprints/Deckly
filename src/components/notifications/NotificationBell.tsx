import { Bell } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUnreadCount } from "../../hooks/useNotifications";
import { useState } from "react";
import { NotificationPanel } from "./NotificationPanel";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface NotificationBellProps {
  userId: string | undefined;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { count } = useUnreadCount(userId);
  const [isOpen, setIsOpen] = useState(false);

  const displayCount = count > 9 ? "9+" : String(count);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
      <button
        className={cn(
          "relative inline-flex h-11 w-11 items-center justify-center rounded-[12px] transition-colors",
          isOpen
            ? "bg-ui-subtle text-ui-text"
            : "text-ui-muted hover:text-ui-text hover:bg-ui-subtle",
        )}
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      >
        <Bell size={20} strokeWidth={1.8} />
        {count > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
              count > 9
                ? "bg-ui-destructive text-ui-surface text-[8px]"
                : "bg-ui-destructive text-ui-surface",
            )}
          >
            {displayCount}
          </span>
        )}
      </button>
      </PopoverTrigger>
      <PopoverContent aria-label="Notifications" align="end" sideOffset={8} collisionPadding={16} className="w-auto border-0 bg-transparent p-0 shadow-none">
        <NotificationPanel userId={userId} onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
