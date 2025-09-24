import { nodesListHandler } from "../src/server/nodes";
import { toWebRequest, sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webReq = toWebRequest(req);
    const webRes = await nodesListHandler(webReq as any);
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/nodes failed", err);
    res.status(500).send("Internal Server Error");
  }
}


