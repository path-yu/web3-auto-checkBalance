import {
  JsonRpcProvider,
  Wallet,
  parseUnits,
  ethers,
  TransactionRequest,
} from "ethers";
import colors from "colors";
interface TransferParams {
  tokenAddress: string; // 代币合约地址
  amount: string; // 转账金额（字符串格式，支持小数）
  to: string; // 接收地址
  privateKey: string; // 发送者私钥
  chainId: number; // 链 ID（如 BNB Chain 的 56）
  rpcUrl: string; // RPC 节点 URL
  gasLimit?: number; // 可选 gas 限制
  gasPrice?: string; // 可选 gas 价格（wei）
  native?: boolean; // 是否为原生代币转账（默认 false）

}
// ERC20 代币 ABI（仅包含 transfer 函数）
const abi = [
  "function transfer(address to, uint256 value) public returns (bool)",
  "function decimals() view returns (uint8)",
];
/**
 * EVM 网络代币转账函数
 * @param params 转账参数
 * @returns 交易哈希
 */
async function transferToken({
  tokenAddress,
  amount,
  to,
  privateKey,
  chainId,
  rpcUrl,
  native = false,
  gasLimit = 21000,
}: TransferParams): Promise<string> {
  try {
    // 初始化 provider 和 wallet
    const provider = new JsonRpcProvider(rpcUrl);
    const wallet = new Wallet(privateKey, provider);

    // 验证地址格式
    if (!ethers.isAddress(to)) {
      throw new Error("Invalid address format");
    }

    // 创建代币合约实例
    const tokenContract = new ethers.Contract(tokenAddress, abi, wallet);

    // 获取代币 decimals
    const decimals = await tokenContract.decimals();
    let gasPrice;
    try {
      gasPrice = (await provider.getFeeData()).gasPrice;
    } catch (error) {
      console.log(colors.red("❌ Failed to fetch gas price from the network."));
    }
    // 转换金额为最小单位
    const parsedAmount = parseUnits(amount, decimals);
    // 构建交易
    const tx: TransactionRequest = {
      chainId,
      gasLimit,
      gasPrice,
      to,
    };
    if (native) {
      tx.value = parsedAmount; // 转账金额为原生代币的最小单位;
      tx.gasLimit = gasLimit ? BigInt(gasLimit) : BigInt(21000); // 原生转账固定 21000 gas
    } else {
      tx.data = tokenContract.interface.encodeFunctionData("transfer", [
        to,
        parsedAmount,
      ]);
    }
    // 签名并发送交易
    const txResponse = await wallet.sendTransaction(tx);

    // 等待交易确认
    const receipt = await txResponse.wait();
    if (receipt && receipt.status === 1) {
      console.log(colors.green("✅ Transaction Success!"));
      console.log(colors.green(`  Block Number: ${receipt.blockNumber}`));
    }
    if (receipt && receipt.status === 1) {
      return txResponse.hash;
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Transfer error:", error);
    throw error;
  }
}
// 转移solana链代币

// 使用示例
async function example() {
  const params: TransferParams = {
    tokenAddress: "0x55d398326f99059fF775485246999027B3197955", // BNB Chain USDT 地址
    amount: "10.5", // 转账 10.5 个代币
    to: "0xRecipientAddress",
    privateKey:
      "0x520ee6d41496e0f8d5f0b6d95b1bda232e3df1b7ce2f75c6767e645d694a5b6d",
    chainId: 56, // BNB Chain 主网
    rpcUrl: "https://bsc-dataseed.binance.org/", // BNB Chain RPC
    gasLimit: 100000,
    gasPrice: parseUnits("5", "gwei").toString(),
  };

  try {
    const txHash = await transferToken(params);
    console.log("Transaction hash:", txHash);
  } catch (error) {
    console.error("Failed to transfer:", error);
  }
}
