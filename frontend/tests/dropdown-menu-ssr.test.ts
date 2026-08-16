import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * Regression test untuk runtime error:
 * "Base UI: MenuGroupContext is missing. Menu group parts must be used
 *  within <Menu.Group> or <Menu.RadioGroup>."
 *
 * Muncul saat `DropdownMenuLabel` (MenuGroupLabel) dirender tanpa dibungkus
 * `DropdownMenuGroup` (Menu.Group) — misalnya di mobile burger menu.
 */
describe("dropdown-menu label", () => {
  it("renders label tanpa error bila dibungkus DropdownMenuGroup", () => {
    const html = renderToStaticMarkup(
      createElement(
        DropdownMenuGroup,
        null,
        createElement(DropdownMenuLabel, null, "Menu"),
        createElement(DropdownMenuSeparator)
      )
    );
    expect(html).toContain("Menu");
  });

  it("melempar error bila label dipakai tanpa DropdownMenuGroup", () => {
    expect(() =>
      renderToStaticMarkup(createElement(DropdownMenuLabel, null, "Menu"))
    ).toThrow(/MenuGroupContext/);
  });
});
