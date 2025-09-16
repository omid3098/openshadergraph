import { describe, it, expect } from "vitest";
import { restoreInputsToDefaults } from "../src/core/ui/resetInputs";

const defaults = {
  inputs: [
    { id: 0, name: "roughness", type: "float", value: [0.5] },
    { id: 1, name: "metallic", type: "float", value: [0.0] },
  ],
};

describe("restoreInputsToDefaults", () => {
  it("restores references to removed nodes using template defaults", () => {
    const removed = new Set<string>(["5"]);
    const { changed, inputs } = restoreInputsToDefaults(
      [
        { id: 0, value: "../5/0" },
        { id: 1, value: [0.2] },
      ],
      defaults.inputs,
      removed,
    );
    expect(changed).toBe(true);
    expect(inputs[0].value).toEqual([0.5]);
    expect(inputs[1].value).toEqual([0.2]);
  });

  it("leaves inputs untouched when no references are removed", () => {
    const removed = new Set<string>(["7"]);
    const current = [
      { id: 0, value: "../5/0" },
      { id: 1, value: [0.2] },
    ];
    const { changed, inputs } = restoreInputsToDefaults(current, defaults.inputs, removed);
    expect(changed).toBe(false);
    expect(inputs).toEqual(current);
  });
});
