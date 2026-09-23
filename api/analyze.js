export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Sadece POST isteği kabul edilir."
    });
  }

  try {
    const body = req.body || {};

    // Farklı frontend isimlerini destekle
    const image =
      body.image ||
      body.imageUrl ||
      body.image_url ||
      body.screenshot;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "Grafik görüntüsü gönderilmedi."
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY bulunamadı. Vercel Environment Variables bölümünü kontrol et."
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content:
                "Sen grafik görüntülerini teknik analiz açısından açıklayan bir asistansın. Görseldeki trend, destek/direnç, mum yapısı, momentum ve indikatörleri değerlendir. Kesinlik veya garanti iddiasında bulunma. Sonucu yalnızca geçerli JSON olarak döndür."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    `Bu grafik görüntüsünü analiz et.

Şunları değerlendir:
- Ana trend
- Kısa vadeli yön
- Destek ve direnç
- Momentum
- Mum formasyonları
- Görülebilen indikatörler
- Yakın vadede yukarı/aşağı hareket ihtimali

JSON formatında cevap ver:
{
  "signal": "YUKARI" veya "AŞAĞI" veya "BEKLE",
  "confidence": 0-100,
  "trend": "YUKARI" veya "AŞAĞI" veya "YATAY",
  "analysis": "kısa açıklama",
  "support": "destek seviyesi veya bilinmiyor",
  "resistance": "direnç seviyesi veya bilinmiyor",
  "reason": "sinyalin temel nedeni"
}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: image
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error?.message || "OpenAI API hatası."
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        success: false,
        error: "AI analiz sonucu alınamadı."
      });
    }

    let result;

    try {
      result = JSON.parse(content);
    } catch {
      result = {
        signal: "BEKLE",
        confidence: 0,
        trend: "YATAY",
        analysis: content,
        support: "Bilinmiyor",
        resistance: "Bilinmiyor",
        reason: "AI sonucu JSON formatında dönmedi."
      };
    }

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message || "Sunucu hatası."
    });
  }
}
