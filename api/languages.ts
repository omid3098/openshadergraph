import { languagesHandler } from "../src/server/handlers";
import { sendWebResponse } from "./_adapter";

export default async function handler(req: any, res: any) {
  try {
    const webRes = await languagesHandler();
    await sendWebResponse(res, webRes);
  } catch (err: any) {
    console.error("[vercel] /api/languages failed", err);
    res.status(500).send("Internal Server Error");
  }
}


