import { compileHandler } from "../src/server/handlers";
import { toWebRequest, sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webReq = toWebRequest(req);
    const webRes = await compileHandler(webReq as any);
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/compile failed", err);
    res.status(500).send("Internal Server Error");
  }
}


