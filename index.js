import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

const server = new Server(
  { name: "xiaozhi-quran-hadith-mcp", version: "1.0.0" }, 
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_quran_ayah",
      description: "সূরা নম্বর এবং আয়াত নম্বর দিয়ে কুরআনের আরবি এবং বাংলা অনুবাদ বের করার টুল।",
      inputSchema: {
        type: "object",
        properties: {
          surah: { type: "number", description: "সূরার নম্বর (যেমন: 1 থেকে 114)" },
          ayah: { type: "number", description: "আয়াতের নম্বর" }
        },
        required: ["surah", "ayah"]
      }
    },
    {
      name: "search_hadith",
      description: "যেকোনো নির্দিষ্ট বিষয়ের উপর (যেমন: নিয়ত, নামাজ, রমজান) সহিহ হাদিস এবং তার রেফারেন্স খোঁজার টুল।",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "হাদিস খোঁজার মূল শব্দ বা টপিক (ইংরেজিতে, যেমন: 'prayer', 'intention')" }
        },
        required: ["keyword"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ১. কুরআন আয়াত ও বাংলা অনুবাদ খোঁজার লজিক
  if (name === "search_quran_ayah") {
    const { surah, ayah } = args;
    try {
      // আরবি টেক্সট এবং বাংলা অনুবাদের জন্য দুটি আলাদা ফ্রি রিকোয়েস্ট
      const arabicRes = await axios.get(`https://alquran.cloud{surah}:${ayah}`);
      const banglaRes = await axios.get(`https://alquran.cloud{surah}:${ayah}/bn.bengali`);

      if (arabicRes.data.code === 200 && banglaRes.data.code === 200) {
        const arabicText = arabicRes.data.data.text;
        const banglaText = banglaRes.data.data.text;
        const surahName = banglaRes.data.data.surah.englishName;

        const result = `সূরা ${surahName} (সূরা নম্বর: ${surah}, আয়াত: ${ayah}):\n\nআরবি: ${arabicText}\n\nবাংলা অনুবাদ: ${banglaText}`;
        return { content: [{ type: "text", text: result }] };
      }
    } catch (error) {
      return { content: [{ type: "text", text: "দুঃখিত রানা ভাই, ইনপুট দেওয়া সূরা বা আয়াত নম্বরটি খুঁজে পাওয়া যায়নি।" }] };
    }
  }

  // ২. সহিহ হাদিস খোঁজার লজিক
  if (name === "search_hadith") {
    const keyword = args.keyword;
    try {
      const response = await axios.get(`https://hadithapi.com{keyword}`);
      // দ্রষ্টব্য: এটি একটি ওপেন সোর্স হাদিস এপিআই, যা দিয়ে তাৎক্ষণিক টপিক ভিত্তিক হাদিস মেলানো যায়
      if (response.data && response.data.hadiths && response.data.hadiths.data.length > 0) {
        const hadith = response.data.hadiths.data[0]; // ১ম সহিহ হাদিসটি নেবে
        const result = `হাদিস গ্রন্থ: ${hadith.book.bookName}\nঅধ্যায়: ${hadith.chapter.chapterName}\n\nহাদিস (বাংলা): ${hadith.hadithBangla}\n\nরেফারেন্স/স্ট্যাটাস: ${hadith.status}`;
        return { content: [{ type: "text", text: result }] };
      } else {
        return { content: [{ type: "text", text: `দুঃখিত রানা ভাই, "${keyword}" বিষয়ের উপর কোনো হাদিস এই মুহূর্তে ডেটাবেজে পাওয়া যায়নি।` }] };
      }
    } catch (error) {
      // ব্যাকআপ রেসপন্স যদি এপিআই লিমিট থাকে
      return { content: [{ type: "text", text: `দুঃখিত রানা ভাই, নেটওয়ার্ক বা এপিআই সমস্যার কারণে হাদিসটি লোড করা যায়নি।` }] };
    }
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
