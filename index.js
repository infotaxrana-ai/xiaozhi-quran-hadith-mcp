import WebSocket from "ws";
import http from "http";
import axios from "axios";

const PORT = process.env.PORT || 10000;
const XIAOZHI_WSS_URL = "wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEwMzIwNzcsImFnZW50SWQiOjI0OTc5NTgsImVuZHBvaW50SWQiOiJhZ2VudF8yNDk3OTU4IiwicHVycG9zZSI6Im1jcC1lbmRwb2ludCIsImlhdCI6MTc5MjA0NTAyMywiZXhwIjoxODIzNjAyNjIzfQ.IxfB-uqYWVbFWRTVjvDXaQ8BF1yUb_kbC1-iRzcYKVpw1RbpXNf1JizO37DWz8__B64iUC0FUDF2M00FSjI5aA";

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Xiaozhi Quran-Hadith MCP is Live!");
}).listen(PORT, () => console.log(`Health check on port ${PORT}`));

function connect() {
  const ws = new WebSocket(XIAOZHI_WSS_URL);
  ws.on("open", () => console.log("Connected Quran MCP to Xiaozhi!"));

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.method === "tools/list") {
        ws.send(JSON.stringify({
          jsonrpc: "2.0", id: msg.id,
          result: {
            tools: [{
              name: "get_quran_verse",
              description: "কুরআনের সূরা ও আয়াত নম্বর দিয়ে বাংলা অনুবাদ পাওয়ার টুল।",
              inputSchema: {
                type: "object",
                properties: {
                  surah: { type: "number", description: "সূরার নম্বর (১-১১৪)" },
                  ayah: { type: "number", description: "আয়াতের নম্বর" }
                },
                required: ["surah", "ayah"]
              }
            }]
          }
        }));
      }

      if (msg.method === "tools/call" && msg.params?.name === "get_quran_verse") {
        const { surah, ayah } = msg.params.arguments || {};
        try {
          const res = await axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/bn.bengali`);
          const data = res.data.data;

          const text = `📖 সূরা ${data.surah.englishName} (${data.surah.name}), আয়াত ${data.numberInSurah}:\n\n"${data.text}"`;
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text }] } }));
        } catch (e) {
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: "Quran fetch failed" } }));
        }
      }
    } catch (e) {}
  });

  ws.on("close", () => setTimeout(connect, 5000));
}
connect();
