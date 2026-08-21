import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface DeckDownloadButtonProps {
  onRequestDownload: (requestId: string) => Promise<{ downloadUrl: string; filename: string }>;
}

export function DeckDownloadButton({ onRequestDownload }: DeckDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const requestId = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { downloadUrl, filename } = await onRequestDownload(requestId);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (err) {
      console.error("Deck download failed", err);
      toast.error("Unable to download this deck. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={() => void handleDownload()}
      disabled={isDownloading}
      className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 bg-[#111] border border-[#333] text-slate-400 hover:text-white transition-all rounded-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download size={16} />
      <span className="text-xs font-semibold">
        {isDownloading ? "Downloading..." : "Download"}
      </span>
    </button>
  );
}
