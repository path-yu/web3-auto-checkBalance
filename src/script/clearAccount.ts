import { mainDb } from "../db/db";
import { clearBalanceDB } from "../db/lastBalanceDB";
import { sendGetRequest, sendPostRequest } from "../request";
import { sleep } from "../ultis";

async function clearAllCount() {
  const response = (await sendGetRequest("/api/v5/wallet/account/accounts"))
    .data[0].accounts;
  for (const account of response) {
    if (account.accountId) {
      try {
        await sendPostRequest("/api/v5/wallet/account/delete-account", {
          accountId: account.accountId,
        });
        console.log("Deleted account:", account.accountId);
        await sleep(1500);
      } catch (error) {
        console.error("Error deleting account:", error);
      }
    }
  }
  // 清空mainDb.json account字段中accountId字段
  mainDb.data.accounts.forEach((item) => {
    item.accountId = "";
  });
  // 写入mainDb.json
  await mainDb.write();
  await clearBalanceDB(); // 清空余额mainDb
  console.log("All accounts cleared and mainDb reset.");
}
clearAllCount();
