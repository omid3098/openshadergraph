import { assetsHandler } from "../src/server/assets";
import { sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webRes = await assetsHandler();
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/assets failed", err);
    res.status(500).send("Internal Server Error");
  }
}


