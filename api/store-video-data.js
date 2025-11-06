// api/store-video-data.js
export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).end();
    }
    if (req.method !== "POST") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.status(405).json({ error: "Method not allowed" });
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    // TODO: wire to durable storage (KV/DB/blob). For now, no-op.
    return res.status(200).json({ status: "Data accepted (no-op on Vercel)" });
  }