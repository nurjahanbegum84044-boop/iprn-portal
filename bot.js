const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const API_TOKEN = "0ZPuP0sLnqHaEIEkupNlnzobAuPFwTURrpr0XBjScUo";
const BASE_URL = "http://187.53.137.91/ints/api/v1/messages";

bot.start((ctx) => {
    ctx.reply(
        "স্বাগতম! ওটিপি দেখতে এই কমান্ড দিন:\n👉 `/otp নাম্বার`\n\nউদাহরণ: `/otp 260959675747`",
        Markup.keyboard([['📥 Check All Recent']]).resize()
    );
});

bot.hears('📥 Check All Recent', async (ctx) => {
    await fetchMessages(ctx, '');
});

bot.command('otp', async (ctx) => {
    const text = ctx.message.text;
    const args = text.split(' ');
    
    if (args.length < 2) {
        return ctx.reply("দয়া করে এভাবে লিখুন:\n`/otp 260959675747`", { parse_mode: 'Markdown' });
    }

    let phoneNumber = args[1].trim().replace(/^\+/, '');
    await fetchMessages(ctx, phoneNumber);
});

async function fetchMessages(ctx, targetNumber) {
    await ctx.reply(targetNumber ? `🔍 নম্বর খুঁজছি: \`${targetNumber}\`...` : "⏳ সাম্প্রতিক মেসেজগুলো চেক করা হচ্ছে...");

    try {
        // এপিআই-এর নিয়ম অনুযায়ী সঠিক UTC ডেট রেঞ্জ তৈরি করা হচ্ছে (যেমনটি প্যানেলে দেখা যায়)
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
            return ctx.reply("📭 আজকের ডেটে এই মুহূর্তে কোনো মেসেজ পাওয়া যায়নি।");
        }

        let filteredMessages = messages;
        if (targetNumber) {
            filteredMessages = messages.filter(msg => {
                const msgNum = String(msg.number || '');
                return msgNum.includes(targetNumber);
            });
        }

        if (filteredMessages.length === 0) {
            return ctx.reply(`❌ প্যানেলে মেসেজ থাকলেও \`${targetNumber}\` নম্বরের সাথে হুবহু মিল পাওয়া যায়নি।`);
        }

        for (let msg of filteredMessages) {
            const fullText = msg.content || msg.text || msg.message || msg.body || JSON.stringify(msg);
            const otpMatch = fullText.match(/\b\d{4,6}\b/);
            const otpCode = otpMatch ? otpMatch[0] : "N/A";
            const number = msg.number || 'Unknown';
            const sender = msg.cli || 'Unknown';
            const time = msg.time || msg.created_at || 'Recent';

            await ctx.reply(
                `📩 *OTP Found!*\n\n` +
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
