export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { clientId, refreshToken, to, subject, body } = req.body;

  if (!clientId || !refreshToken || !to || !subject || !body) {
    return res.status(400).json({ success: false, error: 'সব প্রয়োজনীয় তথ্য দেওয়া হয়নি' });
  }

  try {
    // ১. ব্যাকএন্ডে টোকেন রিফ্রেশ (CORS বাইপাস)
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
        error: tokenData.error_description || 'টোকেন রিফ্রেশ ব্যর্থ হয়েছে' 
      });
    }

    // ২. মাইক্রোসফট গ্রাফ এপিআই দিয়ে ইমেইল সেন্ড
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
        saveToSentItems: 'true'
      })
    });

    if (mailRes.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errData = await mailRes.json();
      return res.status(400).json({ 
        success: false, 
        error: errData.error?.message || 'ইমেইল সেন্ড করতে ব্যর্থ হয়েছে' 
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
