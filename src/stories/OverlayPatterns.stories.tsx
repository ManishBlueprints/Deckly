import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { JoyrideWrapper } from "../components/tours/JoyrideWrapper";

const meta = {
  title: "Patterns/Overlays",
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const DialogOpen: Story = {
  render: () => (
    <Dialog open>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Workspace settings</DialogTitle>
          <DialogDescription>Update the identity shown across your workspace.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <label className="grid gap-2 text-sm font-medium text-ui-text">
            Workspace name
            <input className="h-11 rounded-md border border-ui-border bg-ui-surface px-3 text-ui-text" defaultValue="LapsusNext Workspace" />
          </label>
        </DialogBody>
        <DialogFooter><Button>Save workspace</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const ConfirmationOpen: Story = {
  render: () => (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder?</AlertDialogTitle>
          <AlertDialogDescription>Documents inside will return to Uncategorized. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-ui-destructive text-ui-surface">Delete folder</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

export const PopoverOpen: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild><Button variant="outline">Page search</Button></PopoverTrigger>
      <PopoverContent className="w-80" align="start" aria-label="Page search">
        <p className="text-sm font-semibold text-ui-text">Search this page</p>
        <p className="mt-1 text-xs text-ui-muted">Filter the current page by name or date.</p>
        <input aria-label="Search query" className="mt-4 h-11 w-full rounded-md border border-ui-border bg-ui-surface px-3 text-ui-text" placeholder="Search rooms…" />
      </PopoverContent>
    </Popover>
  ),
};

export const ProductTourOpen: Story = {
  render: () => (
    <div className="flex min-h-64 min-w-96 items-center justify-center p-12">
      <div id="visual-tour-target" className="rounded-lg border border-ui-border bg-ui-surface px-6 py-5 text-sm font-semibold text-ui-text">
        Active workspace
      </div>
      <JoyrideWrapper
        run
        steps={[
          {
            target: "#visual-tour-target",
            title: "Welcome to your workspace",
            content: "Use this area to manage decks, rooms, and saved research.",
          },
        ]}
      />
    </div>
  ),
};
