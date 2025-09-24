import { languagePackHandler } from "../src/server/handlers";
import { toWebRequest, sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webReq = toWebRequest(req);
    const webRes = await languagePackHandler(webReq as any);
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/language failed", err);
    res.status(500).send("Internal Server Error");
  }
}


