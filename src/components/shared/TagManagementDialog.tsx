import { useEffect, useId, useState } from "react";
import { Edit2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { ColorSwatchPicker, type ColorSwatchOption } from "../data-room/shared/ColorSwatchPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";

export interface ManagedTag {
  id: string;
  name: string;
  color: string;
}

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  tags: readonly ManagedTag[];
  colors: readonly ColorSwatchOption[];
  defaultColor: string;
  resolveColorValue(value: string): string;
  resolveColorHex(value: string): string;
  onCreate(name: string, color: string): Promise<unknown>;
  onUpdate(id: string, name: string, color: string): Promise<unknown>;
  onDelete(id: string): Promise<void>;
  description?: string;
}

export function TagManagementDialog({
  open,
  onOpenChange,
  tags,
  colors,
  defaultColor,
  resolveColorValue,
  resolveColorHex,
  onCreate,
  onUpdate,
  onDelete,
  description = "Create and manage tags for filtering and organization.",
}: TagManagementDialogProps) {
  const { theme } = useTheme();
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<ManagedTag | null>(null);
  const inputId = useId();

  const resetForm = () => {
    setName("");
    setSelectedColor(defaultColor);
    setEditingTagId(null);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    setIsSaving(false);
    setDeletingId(null);
    setPendingDeleteTag(null);
    // Reset only when the dialog opens or its configured default changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultColor, open]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      if (editingTagId) await onUpdate(editingTagId, trimmed, selectedColor);
      else await onCreate(trimmed, selectedColor);
      resetForm();
    } catch (error) {
      console.error("Failed to save tag", error);
      toast.error(error instanceof Error ? error.message : "Failed to save tag.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    setDeletingId(tagId);
    try {
      await onDelete(tagId);
      if (editingTagId === tagId) resetForm();
      setPendingDeleteTag(null);
    } catch (error) {
      console.error("Failed to delete tag", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete tag.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !deletingId && onOpenChange(nextOpen)}>
        <DialogContent size="md" closeOnOutsideClick={!isSaving && !deletingId}>
          <DialogHeader>
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-6">
            <section className="space-y-4 rounded-lg border border-ui-border bg-ui-subtle p-4 sm:p-5">
              <div className="space-y-2">
                <label htmlFor={inputId} className="text-xs font-medium text-ui-muted">
                  {editingTagId ? "Tag name" : "New tag name"}
                </label>
                <input
                  id={inputId}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || isSaving) return;
                    event.preventDefault();
                    void handleSave();
                  }}
                  disabled={isSaving || !!deletingId}
                  placeholder="e.g. SaaS, Q3 2024"
                  className="h-11 w-full rounded-md border border-ui-border bg-ui-surface px-3.5 text-sm text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary/45 focus:ring-2 focus:ring-ui-primary/15"
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-ui-muted">Tag color</span>
                <ColorSwatchPicker
                  colors={colors}
                  value={selectedColor}
                  onChange={setSelectedColor}
                  swatchClassName="h-8 w-8 border-ui-border"
                  checkClassName="text-[var(--item-color-foreground)] drop-shadow-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingTagId ? (
                  <button type="button" onClick={resetForm} className="h-10 rounded-md border border-ui-border bg-ui-surface px-4 text-xs font-semibold text-ui-muted hover:bg-ui-elevated hover:text-ui-text">
                    Cancel edit
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving || !name.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-ui-primary px-4 text-xs font-semibold text-ui-primary-text transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingTagId ? "Save tag" : "Create tag"}
                </button>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ui-text">Existing tags</h3>
                <span className="font-mono text-xs text-ui-muted">{tags.length}</span>
              </div>

              {tags.length === 0 ? (
                <div className="rounded-lg border border-dashed border-ui-border bg-ui-subtle px-4 py-8 text-center text-sm text-ui-muted">
                  No tags yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2.5",
                        editingTagId === tag.id
                          ? "border-ui-primary/35 bg-ui-primary/10"
                          : "border-ui-border bg-ui-surface",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-[var(--item-color-border)] bg-[var(--item-color)]"
                          style={asItemColorVariables(getAccessibleColorSet(resolveColorHex(tag.color), theme))}
                        />
                        <span className="truncate text-sm font-medium text-ui-text">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit tag ${tag.name}`}
                          onClick={() => {
                            setEditingTagId(tag.id);
                            setName(tag.name);
                            setSelectedColor(resolveColorValue(tag.color));
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ui-muted hover:bg-ui-subtle hover:text-ui-text"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete tag ${tag.name}`}
                          onClick={() => setPendingDeleteTag(tag)}
                          disabled={deletingId === tag.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-ui-muted hover:bg-ui-destructive/10 hover:text-ui-destructive disabled:opacity-50"
                        >
                          {deletingId === tag.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDeleteTag} onOpenChange={(nextOpen) => !nextOpen && !deletingId && setPendingDeleteTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This tag will be removed anywhere it is currently used. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingDeleteTag) void handleDelete(pendingDeleteTag.id);
              }}
              disabled={!!deletingId}
              className="bg-ui-destructive text-ui-surface hover:brightness-95"
            >
              {deletingId ? "Deleting…" : "Delete tag"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
