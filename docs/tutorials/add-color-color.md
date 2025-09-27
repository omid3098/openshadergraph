---
title: Addition (Color + Color)
---

# Addition (Color + Color)

Add two colors together and feed the result into Albedo.

## Steps

1. Add two `Color` nodes (`constants/color`).
2. Add an `Add` node (`math/add`).
3. Connect `ColorA.out` → `Add.a` and `ColorB.out` → `Add.b`.
4. Add `FragmentOutput` and connect `Add.out` → `Albedo`.

Adjust either color to see the blended result. This pattern extends to vectors and textures as well.

Example graph: `examples/addition_color_color.json`.
