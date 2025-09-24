import { nodeTemplateHandler } from "../src/server/nodes";
import { toWebRequest, sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webReq = toWebRequest(req);
    const webRes = await nodeTemplateHandler(webReq as any);
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/node-template failed", err);
    res.status(500).send("Internal Server Error");
  }
}


