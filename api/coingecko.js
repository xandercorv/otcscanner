export default async function handler(req, res) {
  const params = new URLSearchParams(req.query).toString();
  const url = `https://pro-api.coingecko.com/api/v3/coins/markets?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        "x-cg-demo-api-key": process.env.CG_KEY,
        Accept: "application/json",
      },
    });
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
