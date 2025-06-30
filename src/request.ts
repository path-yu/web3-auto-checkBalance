import * as https from "https";
import * as crypto from "crypto";
import * as querystring from "querystring";
import env from "../env";
import { HttpsProxyAgent } from "https-proxy-agent";
import { api } from "@okxweb3/coin-solana";
import { sleep } from "./ultis";

// 添加代理配置
const proxy = "http://127.0.0.1:7890";
const agent = new HttpsProxyAgent(proxy);
// 定义 API 凭证和项目 ID 的接口
interface ApiConfig {
  api_key: string;
  secret_key: string;
  passphrase: string;
  project: string; // 此处仅适用于 WaaS APIs
}
export const apiBaseUrl = "https://web3.okx.com/"; // Define the underlying path of the request
// 定义 API 凭证
const api_config: ApiConfig = {
  api_key: env.okxApiKey || "",
  secret_key: env.okxApiSecret,
  passphrase: env.okxPassphrase,
  project: env.okxProjectId || "",
};
export type address = {
  chainIndex: string;
  address: string;
};
function preHash(
  timestamp: string,
  method: string,
  request_path: string,
  params?: Record<string, any>
): string {
  // 根据字符串和参数创建预签名
  let query_string = "";
  if (method === "GET" && params) {
    query_string = "?" + querystring.stringify(params);
  }
  if (method === "POST" && params) {
    query_string = JSON.stringify(params);
  }
  return timestamp + method + request_path + query_string;
}

function sign(message: string, secret_key: string): string {
  // 使用 HMAC-SHA256 对预签名字符串进行签名
  const hmac = crypto.createHmac("sha256", secret_key);
  hmac.update(message);
  return hmac.digest("base64");
}

function createSignature(
  method: string,
  request_path: string,
  params?: Record<string, any>,
  custom_api_config: ApiConfig = api_config // 允许传入自定义的 API 配置
): { signature: string; timestamp: string } {
  // 获取 ISO 8601 格式时间戳
  const timestamp = new Date().toISOString().slice(0, -5) + "Z";
  // 生成签名
  const message = preHash(timestamp, method, request_path, params);

  const signature = sign(message, custom_api_config.secret_key);
  return { signature, timestamp };
}
type ResponseData = {
  code: string;
  data: any;
  msg: string;
};
export function sendGetRequest(
  request_path: string,
  params?: Record<string, any>,
  custom_api_config: ApiConfig = api_config // 允许传入自定义的 API 配置
): Promise<ResponseData> {
  return new Promise((resolve, reject) => {
    // 生成签名
    const { signature, timestamp } = createSignature(
      "GET",
      request_path,
      params,
      custom_api_config // 使用自定义的 API 配置
    );

    // 生成请求头
    const headers: Record<string, string> = {
      "OK-ACCESS-KEY": custom_api_config.api_key,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": custom_api_config.passphrase,
      "OK-ACCESS-PROJECT": custom_api_config.project, // 这仅适用于 WaaS APIs
    };

    const options: https.RequestOptions = {
      hostname: "web3.okx.com",
      path: request_path + (params ? `?${querystring.stringify(params)}` : ""),
      method: "GET",
      headers,
      agent, // 使用代理
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: string | Buffer) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data)); // 成功时返回响应数据
        } catch (error) {
          reject(new Error("解析响应数据失败: " + error));
        }
      });
    });

    req.on("error", (error: Error) => {
      reject(error); // 错误时抛出异常
    });

    req.end();
  });
}

export function sendPostRequest(
  request_path: string,
  params?: Record<string, any>,
  custom_api_config: ApiConfig = api_config // 允许传入自定义的 API 配置
): Promise<ResponseData> {
  return new Promise((resolve, reject) => {
    // 生成签名
    const { signature, timestamp } = createSignature(
      "POST",
      request_path,
      params,
      custom_api_config // 使用自定义的 API 配置
    );

    // 生成请求头
    const headers: Record<string, string> = {
      "OK-ACCESS-KEY": custom_api_config.api_key,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": custom_api_config.passphrase,
      "OK-ACCESS-PROJECT": custom_api_config.project, // 这仅适用于 WaaS APIs
      "Content-Type": "application/json", // POST 请求需要加上这个头部
    };

    const options: https.RequestOptions = {
      hostname: "web3.okx.com",
      path: request_path,
      method: "POST",
      headers,
      agent, // 使用代理
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: string | Buffer) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data)); // 成功时返回响应数据
        } catch (error) {
          reject(new Error("解析响应数据失败: " + error));
        }
      });
    });

    req.on("error", (error: Error) => {
      reject(error); // 错误时抛出异常
    });

    if (params) {
      req.write(JSON.stringify(params));
    }

    req.end();
  });
}
export async function safeRequestWithRetry(
  accountId: string,
  maxRetries = 2
): Promise<string | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await sendGetRequest("/api/v5/wallet/asset/total-value", {
        accountId,
      });

      if (result.code !== "0") {
        if (result.code === "50011") {
          throw new Error("Too Many Requests");
        } else {
          console.error(`❌ 查询账户 ${accountId} 失败: ${result.msg}`);
          return null; // 非限流错误直接放弃
        }
      }

      if (result.data && result.data.length > 0) {
        return result.data[0].totalValue;
      }
      return "0";
    } catch (err) {
      const delay = Math.pow(2, attempt) * 500; // 0.5s,1s,2s,4s,8s 指数退避
      console.warn(
        `⚠️ 查询账户 ${accountId} 第 ${attempt + 1} 次重试，等待 ${delay}ms...`
      );
      await sleep(delay);
    }
  }
  console.error(`❌ 查询账户 ${accountId} 多次重试失败，跳过`);
  return null;
}
