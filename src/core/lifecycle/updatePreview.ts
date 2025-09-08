import type { LifecycleContext } from "./types";
import { parseUniformsAndSanitize, type ParsedShader } from "../preview/shaderUtils";

export async function updatePreview(ctx: LifecycleContext<any, any, string>): Promise<ParsedShader> {
  return parseUniformsAndSanitize(ctx.code ?? "");
}
