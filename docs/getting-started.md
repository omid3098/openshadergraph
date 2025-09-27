---
title: Getting Started
---

# Getting Started (Artists)

This guide focuses on creating your first material in the graph editor. Technical setup is covered separately in [Developers](developers.md).

## Create Your First Material

1- From main menu, click on 'File' -> 'New' -> 'PBR'.
This will create a new PBR graph and show the fragment pass by default.

<figure markdown="span">
  ![New Graph](./assets/01_newgraph.png){ width="700" }
  <figcaption>New Graph</figcaption>
</figure>

Notice that in the top bar, you see **`Untitled Pbr > Surface > FragmentPass`**.
A new PBR graph (Unlit and Toon are also the same) is structured like this:

```mermaid
graph TD
    A[Untitled Pbr] --> B[Surface]
    B --> C[FragmentPass]
    B --> D[VertexPass]
    C --> E[FragmentOutput]
    D --> F[VertexOutput]
```

1. Add a `Color` node and pick a color.
2. Add `FragmentOutput` and connect `Color.out` → `Albedo`.
3. Adjust `Roughness` and `Metallic` for the look you want.

Tip: You can connect any node that outputs a color (float3/float4) to `Albedo`.

## Build Variations Quickly

- Try `Add` or `Multiply` to combine colors.
- Use `UV` and `Texture` nodes to sample images.
- Drive `Emission` with bright colors for glow.

## Examples to Load

- Basic Color
- Addition (Color + Color)

Open Tutorials next for step‑by‑step walkthroughs.
