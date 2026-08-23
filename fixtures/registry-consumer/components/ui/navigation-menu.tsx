// Consumer-owned shadcn `navigation-menu` primitive, stubbed at the shape the
// skins use.
import * as React from "react";

interface NavigationMenuProps extends React.HTMLAttributes<HTMLElement> {
  /** shadcn renders the floating viewport unless a consumer opts out. */
  viewport?: boolean;
}

export function NavigationMenu({ viewport: _viewport, ...props }: NavigationMenuProps) {
  return <nav {...props} />;
}

export function NavigationMenuList(props: React.HTMLAttributes<HTMLUListElement>) {
  return <ul {...props} />;
}

export function NavigationMenuItem(props: React.HTMLAttributes<HTMLLIElement>) {
  return <li {...props} />;
}
