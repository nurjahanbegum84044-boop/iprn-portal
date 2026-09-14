const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const API_TOKEN = "0ZPuP0sLnqHaEIEkupNlnzobAuPFwTURrpr0XBjScUo";
const BASE_URL = "http://187.53.137.91/ints/api/v1/messages";

bot.start((ctx) => {
    ctx.reply(
        "স্বাগতম! ওটিপি দেখতে এই কমান্ড দিন:\n👉 `/otp নাম্বার`\n\nউদাহরণ: `/otp 260959661057`",
        Markup.keyboard([['⚡ Status']]).resize()
    );
});

bot.hears('⚡ Status', (ctx) => {
    ctx.reply("বট সচল আছে!");
});

bot.command('otp', async (ctx) => {
    const text = ctx.message.text;
    const args = text.split(' ');
    
    if (args.length < 2) {
        return ctx.reply("দয়া করে এভাবে লিখুন:\n`/otp 260959661057`", { parse_mode: 'Markdown' });
    }

    let phoneNumber = args[1].trim().replace(/^\+/, '');
    await ctx.reply(`নম্বর খুঁজছি: \`${phoneNumber}\`...`, { parse_mode: 'Markdown' });

    try {
        const today = new Date().toISOString().split('T')[0];
        const apiUrl = `${BASE_URL}?token=${API_TOKEN}&number=${encodeURIComponent(phoneNumber)}&from=${encodeURIComponent(today + ' 00:00:00')}&to=${encodeURIComponent(today + ' 23:59:59')}&limit=20`;

        const response = await axios.get(apiUrl, { timeout: 8000 });
        const messages = Array.isArray(response.data) ? response.data : (response.data.data || response.data.messages || []);

        if (messages.length === 0) {
            return ctx.reply(`এই নম্বরে আজকে কোনো নতুন মেসেজ বা ওটিপি পাওয়া যায়নি।`);
        }

        for (let msg of messages) {
            const fullText = msg.text || msg.message || msg.body || JSON.stringify(msg);
            const otpMatch = fullText.match(/\b\d{4,6}\b/);
            const otpCode = otpMatch ? otpMatch[0] : "N/A";
            
            await ctx.reply(
                `📩 *New Message!*\n\n` +
                `📱 *Number:* \`${phoneNumber}\`\n` +
                `💬 *Message:* \`${fullText}\`\n\n` +
                `🔑 *OTP Code:* \`${otpCode}\``,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        ctx.reply("মেসেজ ফেচ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
          
