# 🪙 Account Balance Monitor

This project is a Node.js-based multi-chain wallet balance monitor. It periodically checks for changes in wallet balances and notifies the user via Telegram. It can detect balance changes, recognize newly received tokens, and attempt to match the private key for each token.

---

## 📦 Features

- ✅ Automatically fetches account balances and token assets from OKX API
- 🔀 Randomized request order to avoid triggering rate limits
- 👥 Supports multiple account monitoring
- 📈 Detects balance changes (greater than $1)
- 🪙 Detects newly received tokens (value > $1)
- 🔐 Automatically matches private keys based on token address
- 📬 Sends Telegram notifications
- 💾 Persists balance data using LowDB (local JSON)

