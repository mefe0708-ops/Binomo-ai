export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST gerekli." });
  try {
    const { image, asset, market, timeframe, horizon, mode } = req.body || {};
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return res.status(400).json({ error: "Geçerli grafik görseli gerekli." });
    }
    if (image.length > 7_000_000) return res.status(413).json({ error: "Görsel çok büyük." });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(500).json({ error: "OPENAI_API_KEY backend ortamında tanımlı değil." });

    const prompt = `Sen bir grafik görüntüsü analiz asistanısın. Bu çıktı yatırım tavsiyesi veya garanti değildir.
Kullanıcı bağlamı:
- Piyasa: ${market || "NORMAL"}
- Varlık: ${asset || "Bilinmiyor"}
- Grafik zaman aralığı: ${timeframe || "Bilinmiyor"}
- Analiz ufku: ${horizon || "Bilinmiyor"}
- Mod: ${mode || "Dengeli"}

Ekran görüntüsünü dikkatle incele. Yalnızca görselde gerçekten görülebilen bilgileri kullan.
Mum yapısı, trend, momentum, görünür destek/direnç, varsa RSI/MACD/EMA/ATR gibi göstergeleri değerlendir.
Görselde bir gösterge veya değer okunmuyorsa tahmin etme; "Görünmüyor" yaz.
direction yalnızca YUKARI, AŞAĞI veya BEKLE olabilir. Bu bir işlem emri değildir.
score 0-100 arasında bir MODEL GÜVEN SKORU olsun; gerçek kazanma olasılığı değildir.
Sadece aşağıdaki JSON'u döndür:
{"direction":"YUKARI|AŞAĞI|BEKLE","score":0,"trend":"","momentum":"","rsi":"","volatility":"","support":"","resistance":"","explanation":""}`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: image, detail: "high" }
          ]
        }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "OpenAI API hatası." });
    const text = data.output_text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: "AI JSON sonucu üretmedi.", raw: text.slice(0,1000) });
    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Sunucu hatası." });
  }
}