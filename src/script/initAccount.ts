import config from "../../config";
import { WalletAccount } from "../wallet";
import { address, sendPostRequest } from "../request";
import { sleep } from "../ultis";
import { mainDb, updateLowMainDb, writeToLowMainDb } from "../db/db";



export async function initAccount() {
  let account: WalletAccount[] = [];
  if (mainDb.data.accounts.length === 0) {
    for (const mnemonic of config.mnemonicList) {
      let walletAccount = new WalletAccount(mnemonic);
      for (let i = 0; i < 4; i++) {
        await walletAccount.createAccount(i);
      }
      account.push(walletAccount);
      writeToLowMainDb(walletAccount);
    }
  } else {
    account = mainDb.data.accounts.map((item) => {
      let walletAccount = new WalletAccount(item.mnemonic);
      walletAccount.accounts = item.accounts;
      walletAccount.accountId = item.accountId || null; // 处理可选属性
      return walletAccount;
    });
  }
  for (const walletAccount of account) {
    let addresses: address[] = [];
    for (const accountItem of walletAccount.accounts) {
      if (accountItem.solana.address) {
        addresses.push({
          address: accountItem.solana.address,
          chainIndex: "501",
        });
      }
      if (accountItem.evm.address) {
        addresses.push(
          {
            address: accountItem.evm.address,
            chainIndex: "1",
          },
          {
            address: accountItem.evm.address,
            chainIndex: "56",
          }
        );
      }
      if (accountItem.tron.address) {
        addresses.push({
          address: accountItem.tron.address,
          chainIndex: "195",
        });
      }
    }
    if (walletAccount.accountId) return;
    try {
      let res = await sendPostRequest(
        "/api/v5/wallet/account/create-wallet-account",
        {
          addresses: addresses,
        }
      );
      let accountId = res.data[0].accountId;
      console.log("Account created successfully:", accountId);
      updateLowMainDb(accountId, walletAccount);
      await sleep(1500);
    } catch (error) {
      console.log(error);
    }
  }
}
initAccount();
