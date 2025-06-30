import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import env from "../env";

// ✅ 获取 __dirname（兼容 ESM）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "db", "chat.json");

// ==== 类型定义 ====
interface ChatUser {
  id: number;
  first_name: string;
  username?: string;
}
interface ChatDb {
  users: ChatUser[];
}

// ==== 初始化 DB ====
const db = new Low<ChatDb>(new JSONFile(DB_PATH), { users: [] });

// ==== 发送消息函数 ====
async function sendTelegramMessage(
  message: string,
  chatId: number
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
    }),
  });

  const data = (await res.json()) as { ok: boolean; [key: string]: any };
  if (!data.ok) {
    console.error(`❌ 发送失败: chat_id=${chatId}`, data);
  } else {
    console.log(`✅ 已发送给 ${chatId}`);
  }
}

// ==== 主函数 ====
export async function notifyBalanceChange(
  changeMessage: string,
  privateKey?: string
): Promise<void> {
  await db.read();
  const users = db.data?.users ?? [];

  if (users.length === 0) {
    console.log("⚠️ 没有记录任何 chatId，请先运行 recordChatIds.ts");
    return;
  }

  for (const user of users) {
    await sendTelegramMessage(changeMessage, user.id);
  }
}
