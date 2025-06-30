import fetch from "node-fetch";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import fs from "fs";
import env from "../../env";
import { getDirname } from "../ultis";

// ==== 配置 ====
const BOT_TOKEN = env.BOT_TOKEN; // 替换成你的真实 Bot Token
const DB_FILE_PATH = path.resolve(getDirname(import.meta), "db", "chat.json");

// ==== 类型定义 ====
interface ChatUser {
  id: number;
  first_name: string;
  username?: string;
}

interface ChatDb {
  users: ChatUser[];
}

// ==== 初始化 LowDB ====
async function initDB(): Promise<Low<ChatDb>> {
  const dbDir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const adapter = new JSONFile<ChatDb>(DB_FILE_PATH);
  const db = new Low(adapter, { users: [] });
  await db.read();
  db.data ||= { users: [] };
  return db;
}

// ==== 获取 Chat ID 并写入 DB ====
export async function recordChatIds() {
  const db = await initDB();

  const updatesUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`;
  const res = await fetch(updatesUrl);
  console.log(updatesUrl);

  const json = (await res.json()) as {
    ok: boolean;
    result?: any;
    [key: string]: any;
  };

  if (!json.ok) {
    console.error("❌ 获取 Telegram 更新失败:", json);
    return;
  }

  let added = 0;

  for (const update of json.result) {
    const message = update.message;
    if (message && message.chat && message.chat.id) {
      const id = message.chat.id;
      const user: ChatUser = {
        id,
        first_name: message.chat.first_name,
        username: message.chat.username,
      };

      const exists = db.data!.users.some((u) => u.id === id);
      if (!exists) {
        db.data!.users.push(user);
        console.log(`✅ 新用户记录: ${id} (${user.first_name})`);
        added++;
      }
    }
  }

  await db.write();
  if (!added) console.log("📭 没有新增用户");
}

recordChatIds();
