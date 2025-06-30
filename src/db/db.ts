import { JSONFile } from "lowdb/node";
import { WalletAccount, WalletAccountType } from "../wallet";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Use JSON file for storage
const DB_FILE_PATH = resolve(__dirname, "db", "db.json");

const adapter = new JSONFile<Data>(DB_FILE_PATH);

type Data = {
  accounts: WalletAccountType[];
};
const mainDb = new Low<Data>(adapter, { accounts: [] });

// Read data from JSON file, this will set db.data content
await mainDb.read();

// If file.json doesn't exist, db.data will be null
// Set default data
mainDb.data ||= { accounts: [] };

export { mainDb };
// 写入lowmainDb
export async function writeToLowMainDb(walletAccount: WalletAccount) {
  const { accounts } = mainDb.data;
  accounts.push({
    mnemonic: walletAccount.mnemonic,
    accounts: walletAccount.accounts,
    accountId: "",
  });
  // Write mainDb.data content to mainDb.json
  await mainDb.write();
  console.log("Wallet accounts written to lowmainDb:", walletAccount.accounts);
}
// 更新lowmainDb
export async function updateLowMainDb(
  accountId: string,
  walletAccount: WalletAccount
) {
  const { accounts } = mainDb.data;
  const index = accounts.findIndex(
    (item) => item.mnemonic === walletAccount.mnemonic
  );
  if (index !== -1) {
    accounts[index].accountId = accountId;
    await mainDb.write();
    console.log("Updated accountId in lowmainDb:", accountId);
  } else {
    console.error("Account not found in lowmainDb");
  }
}
export function getAllAccount() {
  return mainDb.data.accounts.map((item) => {
    let walletAccount = new WalletAccount(item.mnemonic);
    walletAccount.accounts = item.accounts;
    walletAccount.accountId = item.accountId || null; // 处理可选属性
    return walletAccount;
  });
}
