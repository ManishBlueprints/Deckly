import { Toaster } from "sonner";
import { useTheme } from "../../contexts/ThemeContext";

export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      richColors
      toastOptions={{
        classNames: {
          toast: "!rounded-[14px] !border-ui-border !bg-ui-elevated !text-ui-text !shadow-[var(--ui-shadow-overlay)]",
          description: "!text-ui-muted",
        },
      }}
    />
  );
}
