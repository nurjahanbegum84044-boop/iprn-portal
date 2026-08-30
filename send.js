module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { clientId, refreshToken, to, subject, body } = req.body || {};

  if (!clientId || !refreshToken || !to || !subject || !body) {
    return res.status(400).json({ success: false, error: 'সব প্রয়োজনীয় তথ্য পূরণ করা হয়নি' });
  }

  try {
    // ১. টোকেন রিফ্রেশ করা
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'https://graph.microsoft.com/Mail.Send offline_access'
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(400).json({ 
        success: false, 
        error: tokenData.error_description || tokenData.error || 'টোকেন রিফ্রেশ ব্যর্থ হয়েছে' 
      });
    }

    // ২. ইমেইল পাঠানো
    const mailRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject: subject,
          body: { contentType: 'HTML', content: body },
          toRecipients: [{ emailAddress: { address: to } }]
        },
        saveToSentItems: "true"
      })
    });

    if (mailRes.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errData = await mailRes.json();
      return res.status(400).json({ 
        success: false, 
        error: errData.error?.message || 'ইমেইল পাঠানো সম্ভব হয়নি' 
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
