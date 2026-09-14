const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const API_TOKEN = "0ZPuP0sLnqHaEIEkupNlnzobAuPFwTURrpr0XBjScUo";
const BASE_URL = "http://187.53.137.91/ints/api/v1/messages";

bot.start((ctx) => {
    ctx.reply(
        "স্বাগতম! প্যানেলে আসা সাম্প্রতিক ওটিপিগুলো দেখতে নিচের বাটনে ক্লিক করুন:",
        Markup.keyboard([['📥 Check Latest OTP']]).resize()
    );
});

bot.hears('📥 Check Latest OTP', async (ctx) => {
    await fetchMessages(ctx);
});

bot.command('otp', async (ctx) => {
    await fetchMessages(ctx);
});

async function fetchMessages(ctx) {
    await ctx.reply("⏳ সার্ভার থেকে সাম্প্রতিক মেসেজ ও ওটিপি চেক করা হচ্ছে...");

    try {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        
        const fromDate = `${year}-${month}-${day} 00:00:00`;
        const toDate = `${year}-${month}-${day} 23:59:59`;

        const apiUrl = `${BASE_URL}?token=${API_TOKEN}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&limit=15`;

        const response = await axios.get(apiUrl, { timeout: 8000 });
        const resData = response.data;
        
        const messages = resData.records || resData.data || (Array.isArray(resData) ? resData : []);

        if (messages.length === 0) {
            return ctx.reply("📭 এই মুহূর্তে কোনো মেসেজ পাওয়া যায়নি।");
        }

        for (let msg of messages) {
            const fullText = msg.content || msg.text || msg.message || msg.body || JSON.stringify(msg);
            const otpMatch = fullText.match(/\b\d{4,6}\b/);
            const otpCode = otpMatch ? otpMatch[0] : "N/A";
            const number = msg.number || 'Unknown';
            const sender = msg.cli || 'Unknown';
            const time = msg.time || msg.created_at || 'Recent';

            await ctx.reply(
                `📩 *OTP Message Found!*\n\n` +
                `📱 *Number:* \`${number}\`\n` +
                `📤 *Sender:* \`${sender}\`\n` +
                `⏱️ *Time:* \`${time}\`\n\n` +
                `💬 *Message:* \`${fullText}\`\n\n` +
                `🔑 *OTP Code:* \`${otpCode}\``,
                { parse_mode: 'Markdown' }
            );
        }
    } catch (error) {
        console.error(error);
        ctx.reply("❌ মেসেজ ফেচ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
}

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
