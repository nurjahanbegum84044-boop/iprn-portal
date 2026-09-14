const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const API_TOKEN = "0ZPuP0sLnqHaEIEkupNlnzobAuPFwTURrpr0XBjScUo";
const BASE_URL = "http://187.53.137.91/ints/api/v1/messages";

bot.start((ctx) => {
    ctx.reply(
        "স্বাগতম! আপনার প্যানেলের ইনকামিং ওটিপি দেখতে নিচের বাটনে ক্লিক করুন অথবা কমান্ড দিন:",
        Markup.keyboard([['📥 Check Latest OTP', '⚡ Status']]).resize()
    );
});

bot.hears('⚡ Status', (ctx) => {
    ctx.reply("বট সচল আছে এবং API কানেক্টেড!");
});

// বাটন অথবা কমান্ডে কাজ করবে
bot.hears('📥 Check Latest OTP', async (ctx) => {
    await fetchAndShowMessages(ctx);
});

bot.command('otp', async (ctx) => {
    await fetchAndShowMessages(ctx);
});

async function fetchAndShowMessages(ctx) {
    await ctx.reply("⏳ সার্ভার থেকে সাম্প্রতিক ওটিপি মেসেজগুলো চেক করা হচ্ছে...");

    try {
        // কোনো নির্দিষ্ট নাম্বার ফিল্টার ছাড়া সরাসরি সাম্প্রতিক মেসেজগুলো ফেচ করা হচ্ছে যাতে একটিও মিস না হয়
        const apiUrl = `${BASE_URL}?token=${API_TOKEN}&limit=15`;

        const response = await axios.get(apiUrl, { timeout: 8000 });
        const rawData = response.data;
        const messages = Array.isArray(rawData) ? rawData : (rawData.data || rawData.messages || rawData.result || []);

        if (messages.length === 0) {
            return ctx.reply("📭 এই মুহূর্তে প্যানেলে কোনো মেসেজ পাওয়া যায়নি।");
        }

        for (let msg of messages) {
            const fullText = msg.text || msg.message || msg.body || JSON.stringify(msg);
            const otpMatch = fullText.match(/\b\d{4,6}\b/);
            const otpCode = otpMatch ? otpMatch[0] : "N/A";
            const number = msg.number || msg.to || 'Unknown';
            const sender = msg.cli || msg.sender || 'Unknown';
            const time = msg.created_at || msg.date || 'Recent';

            await ctx.reply(
                `📩 *New OTP / Message Found!*\n\n` +
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
        ctx.reply("❌ মেসেজ ফেচ করতে সমস্যা হয়েছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।");
    }
}

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
