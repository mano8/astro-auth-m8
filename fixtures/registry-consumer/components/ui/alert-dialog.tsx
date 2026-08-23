import * as React from "react";

interface RootProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialog({ children }: RootProps) {
  return <>{children}</>;
}

export function AlertDialogContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}

export function AlertDialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function AlertDialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} />;
}

// shadcn renders the action and cancel buttons through `buttonVariants`, so both
// take the button variant/size props.
interface AlertDialogButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function AlertDialogAction({ variant: _variant, size: _size, ...props }: AlertDialogButtonProps) {
  return <button type="button" {...props} />;
}

export function AlertDialogCancel({ variant: _variant, size: _size, ...props }: AlertDialogButtonProps) {
  return <button type="button" {...props} />;
}
