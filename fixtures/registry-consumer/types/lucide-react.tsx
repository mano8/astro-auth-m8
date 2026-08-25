import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement>;
export type Icon = React.ComponentType<IconProps>;

function createIcon(name: string): Icon {
  const Component = (props: IconProps) => <svg aria-label={name} {...props} />;
  Component.displayName = name;
  return Component;
}

export const Activity = createIcon("Activity");
export const AlertCircle = createIcon("AlertCircle");
export const ArrowDown = createIcon("ArrowDown");
export const ArrowUp = createIcon("ArrowUp");
export const Check = createIcon("Check");
export const ChevronLeft = createIcon("ChevronLeft");
export const ChevronRight = createIcon("ChevronRight");
export const ChevronsLeft = createIcon("ChevronsLeft");
export const ChevronsRight = createIcon("ChevronsRight");
export const ChevronsUpDown = createIcon("ChevronsUpDown");
export const EyeOff = createIcon("EyeOff");
export const Inbox = createIcon("Inbox");
export const KeyRound = createIcon("KeyRound");
export const LayoutDashboard = createIcon("LayoutDashboard");
export const LogOut = createIcon("LogOut");
export const Pencil = createIcon("Pencil");
export const PlusCircle = createIcon("PlusCircle");
export const RefreshCw = createIcon("RefreshCw");
export const RotateCcw = createIcon("RotateCcw");
export const Search = createIcon("Search");
export const Settings2 = createIcon("Settings2");
export const ShieldAlert = createIcon("ShieldAlert");
export const Trash2 = createIcon("Trash2");
export const TrendingUp = createIcon("TrendingUp");
export const UserPlus = createIcon("UserPlus");
export const Users = createIcon("Users");
export const X = createIcon("X");
