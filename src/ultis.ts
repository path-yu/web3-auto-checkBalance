// utils/getDirname.ts
import { fileURLToPath } from "url";
import path from "path";

// 指定等待休眠
export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// 限制并发数的帮助函数
export async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T) => Promise<R>
): Promise<R[]> {
  const ret: R[] = [];
  const executing: Promise<any>[] = [];

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p as unknown as R);

    if (poolLimit <= array.length) {
      const e: Promise<any> = p.then(() =>
        executing.splice(executing.indexOf(e), 1)
      );
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

/**
 * 获取当前模块的 __dirname 路径（兼容 ESM）
 * @param importMeta - 传入 import.meta
 * @returns string 路径
 */
export function getDirname(importMeta: ImportMeta): string {
  const __filename = fileURLToPath(importMeta.url);
  return path.dirname(__filename);
}
export function randomDelay(minMs: number, maxMs: number) {
  return minMs + Math.random() * (maxMs - minMs);
}
export function shuffleArray(arr) {
  const result = arr.slice(); // 创建副本，避免修改原数组
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); // 0 到 i 的随机索引
    [result[i], result[j]] = [result[j], result[i]]; // 交换
  }
  return result;
}
