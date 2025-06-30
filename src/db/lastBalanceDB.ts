import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 指定 JSON 文件位置
const file = path.join(__dirname, "lastBalances.json");
const adapter = new JSONFile<Record<string, string>>(file);
export const db = new Low(adapter, {});

// 初始化 DB
export async function initBalanceDB() {
  await db.read();
  db.data ||= {}; // 如果为空，初始化为空对象
  await db.write();
}
// 清空 DB
export async function clearBalanceDB() {
  db.data = {};
  await db.write();
}
