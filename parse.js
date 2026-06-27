// Vercel serverless function: receives a screenshot, asks Groq's vision model
// to extract health metrics as JSON, returns them to the dashboard.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GROQ_API_KEY' });
  }
  try {
    const { image } = req.body; // expects a data URL: "data:image/png;base64,..."
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const prompt = `You are reading a screenshot from a health/fitness app (Garmin or Ultrahuman).
Extract any of these daily metrics you can find. Return ONLY a JSON object, no other text.
Use this exact shape, omitting any field not visible in the image:
{
  "date": "YYYY-MM-DD or null if not shown",
  "glucose_avg": number or null,
  "resting_hr": number or null,
  "steps": number or null,
  "stress": number or null,
  "sleep_score": number or null,
  "hrv": number or null,
  "body_battery": number or null
}
Only include numbers you can actually see. Do not guess.

IMPORTANT RULES:
- Only extract data for a SINGLE specific day. If the screenshot shows a multi-day range, weekly/4-week/yearly view, or an AVERAGE over a period (e.g. "Avg Resting", "31 May - 27 Jun"), do NOT extract those averages. Return {"range_view": true} and nothing else.
- Only set "date" if a specific single calendar date is clearly shown for the values. If the date is ambiguous or a range, set "date": null.
If you see no single-day health metrics, return {}.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }],
        temperature: 0,
        max_completion_tokens: 512,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return res.status(502).json({ error: 'Groq error', detail: errText });
    }
    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); }
    catch { return res.status(502).json({ error: 'Model did not return valid JSON', raw: content }); }
    return res.status(200).json({ metrics: parsed });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err) });
  }
}
