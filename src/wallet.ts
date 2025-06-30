import { bip39, bip32, signUtil, base } from "@okxweb3/crypto-lib";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { privateToAddress, toChecksumAddress } from "ethereumjs-util";

let chainMap = {
  solana: "501",
  evm: "1",
  tron: "195",
  ton: "396",
  bnb: "56",
};
// 根据chainIndex获取链名称
export function getChainNameByIndex(chainIndex: string): Chain | null {
  for (const [key, value] of Object.entries(chainMap)) {
    if (value === chainIndex) {
      return key as Chain;
    }
  }
  return null; // 如果没有找到对应的链，返回 null
}
export interface Transaction {
  chainIndex: string;
  txHash: string;
  methodId: string;
  nonce: string;
  txTime: string;
  from: { address: string };
  to: { address: string };
  tokenAddress: string;
  amount: string; // string number
  symbol: string;
  txFee: string; // string number
  txStatus: string;
  hitBlacklist: boolean;
  tag: string;
  itype: string;
}
export type Account = {
  solana: {
    address: string;
    privateKey: string;
  };
  index: number;
  evm: {
    address: string;
    privateKey: string;
  };

  tron: {
    address: string;
    privateKey: string;
  };
};
export type TokenAsset = {
  symbol: string;
  balance: string;
  tokenPrice: string;
  address: string;
  chainIndex: string; // 例如 "501" 对应 Solana, "1" 对应 EVM, "195" 对应 Tron
};
export type WalletAccountType = {
  mnemonic: string;
  accounts: Account[];
  accountId?: string; // 可选属性，可能在某些情况下没有
  totalValue?: string; // 可选属性，可能在某些情况下没有
};
export interface MatchedTokenInfo extends TokenAsset {
  tokenValue: number;
  privateKey: string;
  mnemonic: string;
};
export class WalletAccount {
  accounts: Account[];
  mnemonic: string;
  // hasAdd:true;
  accountId: string | null = null;
  totalValue?: string; // 可选属性，可能在某些情况下没有

  constructor(mnemonic) {
    this.mnemonic = mnemonic;
    this.accounts = [];
    this.accountId = null;
  }

  async createAccount(index = 1) {
    //创建solana账户
    let solanaAccount = await createAccountFromMnemonic(
      this.mnemonic,
      index,
      "solana"
    );
    let account: Account = {
      solana: {
        address: solanaAccount.publicKey,
        privateKey: solanaAccount.privateKey,
      },
      index,
      evm: {
        address: "",
        privateKey: "",
      },

      tron: {
        address: "",
        privateKey: "",
      },
    };
    //创建以太坊账户
    let ethereumAccount = await createAccountFromMnemonic(
      this.mnemonic,
      index,
      "evm"
    );
    account.evm!.address = ethereumAccount.address || "";
    account.evm!.privateKey = ethereumAccount.privateKey || "";
    //创建tron账户
    let tronAccount = await createAccountFromMnemonic(
      this.mnemonic,
      index,
      "tron"
    );
    // 主钱包是多签钱包 不需要 tron 地址和私钥
    if (index !== 0) {
      account.tron!.address = tronAccount.address || "";
      account.tron!.privateKey = tronAccount.privateKey || "";
    }

    this.accounts.push(account);
  }
}

export type Chain = "solana" | "evm" | "tron" | "ton";

export function tronAddressFromPubkey(pubkey: Uint8Array): string {
  // 1. 转换为 uncompressed 公钥（65字节，前缀0x04）
  const uncompressed = signUtil.secp256k1.publicKeyConvert(pubkey, false);

  // 2. Keccak256 对公钥主体部分进行哈希（去掉首字节0x04）
  if (!uncompressed) {
    throw new Error("Failed to convert public key to uncompressed format");
  }
  const hash = base.keccak256(uncompressed.slice(1));

  // 3. 取最后20字节，加上TRON地址前缀 0x41
  const addressBytes = base.concatBytes(Uint8Array.of(0x41), hash.slice(-20));

  // 4. 双SHA256作为checksum，取前4字节
  const checksum = base.sha256(base.sha256(addressBytes)).slice(0, 4);

  // 5. 拼接地址体 + 校验码，Base58编码
  const fullAddress = base.concatBytes(addressBytes, checksum);
  return base.toBase58(fullAddress);
}

export async function createAccountFromMnemonic(
  mnemonic: string,
  accountIndex = 0,
  chain: Chain = "evm"
) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("助记词无效");
  }

  switch (chain) {
    case "solana": {
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const path = `m/44'/501'/${accountIndex}'/0'`;
      const derivedSeed = derivePath(path, seed.toString("hex")).key;
      const keypair = Keypair.fromSeed(derivedSeed);

      return {
        chain,
        address: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
        publicKey: keypair.publicKey.toBase58(),
      };
    }

    case "evm":
    case "tron": {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const coinType = chain === "tron" ? 195 : 60;
      const path = `m/44'/${coinType}'/0'/0/${accountIndex}`;
      const root = bip32.fromSeed(seed);
      const child = root.derivePath(path);

      if (!child.privateKey) {
        throw new Error("派生失败，没有私钥");
      }

      const privateKey = child.privateKey;

      if (chain === "tron") {
        const address = tronAddressFromPubkey(child.publicKey);
        return {
          chain,
          address,
          privateKey: "0x" + privateKey.toString("hex"),
          publicKey: "0x" + child.publicKey.toString("hex"),
        };
      } else {
        const addressBuffer = privateToAddress(privateKey);
        const address = toChecksumAddress("0x" + addressBuffer.toString("hex"));
        return {
          chain,
          address,
          privateKey: "0x" + privateKey.toString("hex"),
          publicKey: "0x" + child.publicKey.toString("hex"),
        };
      }
    }
    default:
      throw new Error(`不支持的链：${chain}`);
  }
}

// let walletAccount = new WalletAccount(
//   "knee three city beef benefit blind meadow tape negative brick bicycle curious"
// );
// (async () => {
//   await walletAccount.createAccount(1);
//   await walletAccount.createAccount(2);
//   await walletAccount.createAccount(3);
//   console.log(walletAccount.accounts);
// })().catch(console.error);
