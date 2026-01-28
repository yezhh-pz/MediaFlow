# 🌊 MediaFlow

**MediaFlow** 是一个现代化的、模块化的视频字幕与处理工作站。基于 Electron + React + Python (FastAPI) 构建。

## 🏗️ 项目结构

```
Mediaflow/
├── src/           # Python 后端 (FastAPI)
├── frontend/      # Electron + React 前端
├── bin/           # FFmpeg 等可执行工具
├── models/        # AI 模型
├── scripts/       # 辅助脚本
└── Archive/       # 归档文件
```

## 🚀 快速启动

### 1. 后端启动

```powershell
python -m uvicorn src.main:app --host 127.0.0.1 --port 8001 --reload
```

### 2. 前端启动

```powershell
npm run dev
```

## 🛠️ 环境预设

- **Python**: 3.10+ (推荐使用 uv 管理依赖)
- **Node.js**: 18+
- **FFmpeg**: 已在 `bin/` 中集成

---

_Created with ❤️ by AntiGravity Agent._
