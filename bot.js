const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const API_TOKEN = "0ZPuP0sLnqHaEIEkupNlnzobAuPFwTURrpr0XBjScUo";
const BASE_URL = "http://187.53.137.91/ints/api/v1/messages";

// স্টার্ট কমান্ড
bot.start((ctx) => {
    ctx.reply(
        "স্বাগতম! আপনার নির্দিষ্ট নম্বরের ওটিপি দেখতে নিচের কমান্ডটি ব্যবহার করুন:\n\n👉 `/otp <phone_number>`\nউদাহরণ: `/otp 260959675747`",
        Markup.keyboard([['⚡ Status']]).resize()
    );
});

bot.hears('⚡ Status', (ctx) => {
    ctx.reply("বট সম্পূর্ণ সচল ও সিকিউর রয়েছে!");
});

// নির্দিষ্ট নম্বর দিয়ে ওটিপি খোঁজার কমান্ড
bot.command('otp', async (ctx) => {
    const text = ctx.message.text;
    const args = text.split(' ');
    
    if (args.length < 2) {
        return ctx.reply("❌ দয়া করে সঠিক ফরম্যাটে নম্বর দিন। যেমন:\n`/otp 260959675747`", { parse_mode: 'Markdown' });
    }

    let targetNumber = args[1].trim().replace(/^\+/, '');
    await ctx.reply(`🔍 নম্বর \`${targetNumber}\`-এর জন্য ওটিপি খোঁজা হচ্ছে...`, { parse_mode: 'Markdown' });

    try {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const day = String(now.getUTCDate()).padStart(2, '0');
        
        const fromDate = `${year}-${month}-${day} 00:00:00`;
        const toDate = `${year}-${month}-${day} 23:59:59`;

        const apiUrl = `${BASE_URL}?token=${API_TOKEN}&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&limit=50`;

        const response = await axios.get(apiUrl, { timeout: 8000 });
        const resData = response.data;
        
        const messages = resData.records || resData.data || (Array.isArray(resData) ? resData : []);

        if (messages.length === 0) {
            return ctx.reply("📭 এই মুহূর্তে সার্ভারে কোনো মেসেজ পাওয়া যায়নি।");
        }

        // শুধু ইউজারের দেওয়া নির্দিষ্ট নম্বরটির সাথে যে মেসেজগুলো মিলবে, সেগুলোই ফিল্টার করা হবে
        const filteredMessages = messages.filter(msg => {
            const msgNum = String(msg.number || '');
            return msgNum.includes(targetNumber);
        });

        if (filteredMessages.length === 0) {
            return ctx.reply(`❌ \`${targetNumber}\` এই নম্বরের জন্য এখনো কোনো ওটিপি আসেনি।`);
        }

        for (let msg of filteredMessages) {
            const fullText = msg.content || msg.text || msg.message || msg.body || JSON.stringify(msg);
            const otpMatch = fullText.match(/\b\d{4,6}\b/);
            const otpCode = otpMatch ? otpMatch[0] : "N/A";
            const sender = msg.cli || 'Unknown';
            const time = msg.time || msg.created_at || 'Recent';

            await ctx.reply(
                `📩 *OTP Found for Your Number!*\n\n` +
                `📱 *Number:* \`${targetNumber}\`\n` +
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
});

bot.launch();
process.once('SIGINT', => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
