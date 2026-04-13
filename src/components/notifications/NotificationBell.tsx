import { Bell } from "lucide-react";
import { cn } from "../../utils/cn";
import { useUnreadCount } from "../../hooks/useNotifications";
import { useState, useRef, useEffect } from "react";
import { NotificationPanel } from "./NotificationPanel";

interface NotificationBellProps {
  userId: string | undefined;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { count } = useUnreadCount(userId);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const displayCount = count > 9 ? "9+" : String(count);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          isOpen
            ? "bg-white/10 text-slate-100"
            : "text-slate-500 hover:text-slate-200 hover:bg-white/5",
        )}
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      >
        <Bell size={20} strokeWidth={1.8} />
        {count > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
              count > 9
                ? "bg-red-500 text-white text-[8px]"
                : "bg-red-500 text-white",
            )}
          >
            {displayCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="fixed inset-x-4 top-16 mt-3 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 z-50"
        >
          <NotificationPanel
            userId={userId}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
