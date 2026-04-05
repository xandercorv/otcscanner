export default async function handler(req, res) {
  const params = new URLSearchParams(req.query).toString();
  const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": process.env.CMC_KEY,
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
