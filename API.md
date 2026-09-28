# 🔌 云宿管家 (CloudInn) RESTful API 规范文档

本文档为 **云宿管家 (CloudInn) 酒店收支管理与收益统计系统** 的后端 API 完整技术规范。供前端开发、移动端对接、第三方集成及自动化测试参考。

---

## 📌 通用约定

### 1. 基础路径与通讯协议
- **协议**：HTTP / HTTPS
- **Base URL**：`/api`
- **数据传输格式**：`application/json; charset=utf-8`

### 2. 身份鉴权 (Authentication)
除 `/api/health`、`/api/login`、`/api/register` 为公开接口外，所有受保护接口均需在 HTTP Header 中携带 JWT Token：

```http
Authorization: Bearer <your_jwt_token>
```

### 3. HTTP 状态码规范

| 状态码 | 含义 | 说明 |
| :--- | :--- | :--- |
| `200 OK` | 请求成功 | 包含预期的业务数据 |
| `400 Bad Request` | 请求参数有误 | 缺少必填字段或数据格式不合规 |
| `401 Unauthorized` | 身份鉴权失败 | 未携带 Token、Token 无效或已过期 |
| `403 Forbidden` | 权限不足或账号受限 | 账号被停用，或缺少当前操作所需的模块权限 |
| `404 Not Found` | 资源不存在 | 请求的记录 ID 不存在 |
| `500 Internal Server Error` | 服务器内部错误 | 捕获到未处理的数据库或系统异常 |

### 4. 统一错误返回格式

```json
{
  "error": "错误详细描述信息"
}
```

---

## 📑 接口目录

- [1. 系统健康检查](#1-系统健康检查)
- [2. 用户认证与会话 (Auth)](#2-用户认证与会话-auth)
- [3. 员工管理与权限配置 (Staff Management - 老板专属)](#3-员工管理与权限配置-staff-management---老板专属)
- [4. 每日房费收入上报 (Reports)](#4-每日房费收入上报-reports)
- [5. 经营成本与支出登记 (Expenses)](#5-经营成本与支出登记-expenses)
- [6. 月度统计与经营看板 (Stats)](#6-月度统计与经营看板-stats)

---

## 1. 系统健康检查

### 1.1 获取系统运行健康状态
- **URL**：`GET /api/health`
- **鉴权**：公开

#### 响应示例 (`200 OK`)
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-09-27T10:00:00.000Z"
}
```

---

## 2. 用户认证与会话 (Auth)

### 2.1 用户登录
- **URL**：`POST /api/login`
- **鉴权**：公开

#### 请求参数 (Body)
```json
{
  "username": "boss",
  "password": "boss12345"
}
```

#### 响应示例 (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "boss",
    "name": "酒店老板",
    "role": "boss",
    "status": "active",
    "permissions": ["report", "expense", "stats", "users"]
  }
}
```

---

### 2.2 员工注册
- **URL**：`POST /api/register`
- **鉴权**：公开
- **说明**：注册成功后默认分配 `role: "employee"`, `permissions: ["report"]`。

#### 请求参数 (Body)
```json
{
  "username": "receptionist_sophea",
  "password": "SafePassword123",
  "name": "Sophea"
}
```

#### 响应示例 (`200 OK`)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "username": "receptionist_sophea",
    "name": "Sophea",
    "role": "employee",
    "status": "active",
    "permissions": ["report"]
  }
}
```

---

### 2.3 获取当前登录用户信息
- **URL**：`GET /api/me` 或 `GET /api/auth/me`
- **鉴权**：需登录

#### 响应示例 (`200 OK`)
```json
{
  "user": {
    "id": 2,
    "username": "receptionist_sophea",
    "name": "Sophea",
    "role": "employee",
    "status": "active",
    "permissions": ["report", "expense"]
  }
}
```

---

### 2.4 退出登录
- **URL**：`POST /api/logout`
- **鉴权**：需登录

#### 响应示例 (`200 OK`)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 3. 员工管理与权限配置 (Staff Management - 老板专属)

> [!IMPORTANT]
> 本组接口仅限 `role === "boss"` 的账号访问。

### 3.1 获取员工列表及权限
- **URL**：`GET /api/users`
- **鉴权**：老板专属

#### 响应示例 (`200 OK`)
```json
[
  {
    "id": 2,
    "username": "sophea",
    "name": "Sophea",
    "role": "employee",
    "status": "active",
    "permissions": ["report", "stats"],
    "created_at": "2026-09-20 12:30:00"
  },
  {
    "id": 3,
    "username": "david",
    "name": "David",
    "role": "employee",
    "status": "disabled",
    "permissions": ["report"],
    "created_at": "2026-09-22 14:10:00"
  }
]
```

---

### 3.2 创建新员工账号
- **URL**：`POST /api/users`
- **鉴权**：老板专属

#### 请求参数 (Body)
```json
{
  "username": "lina",
  "password": "Password123",
  "name": "Lina",
  "permissions": ["report", "expense"]
}
```

#### 响应示例 (`200 OK`)
```json
{
  "id": 4,
  "username": "lina",
  "name": "Lina",
  "role": "employee",
  "status": "active",
  "permissions": ["report", "expense"]
}
```

---

### 3.3 修改员工信息与权限
- **URL**：`PUT /api/users/:id`
- **鉴权**：老板专属

#### 请求参数 (Body)
所有字段均为选填，不传入则保持原值：
```json
{
  "name": "Lina (Morning Shift)",
  "password": "NewOptionalPassword",
  "permissions": ["report", "expense", "stats"],
  "status": "active"
}
```

#### 响应示例 (`200 OK`)
```json
{
  "id": 4,
  "username": "lina",
  "name": "Lina (Morning Shift)",
  "role": "employee",
  "status": "active",
  "permissions": ["report", "expense", "stats"],
  "created_at": "2026-09-27 08:00:00"
}
```

---

### 3.4 切换员工账号启用/停用状态
- **URL**：`PATCH /api/users/:id/status`
- **鉴权**：老板专属
- **说明**：在 `active` 与 `disabled` 之间切换。被停用的账号将无法登录系统。支持在请求体中传 `{ "status": "disabled" }` 或直接调用自动反转。

#### 响应示例 (`200 OK`)
```json
{
  "success": true,
  "message": "User status changed to disabled",
  "status": "disabled"
}
```

---

### 3.5 彻底删除员工账号
- **URL**：`DELETE /api/users/:id`
- **鉴权**：老板专属
- **说明**：从数据库中永久移除该员工账号（禁止删除老板账号）。该员工之前历史已提交的营业报表仍将保留其当时填报的姓名快照，不会影响历史财务统计。

#### 响应示例 (`200 OK`)
```json
{
  "success": true,
  "message": "User account deleted successfully",
  "id": 4
}
```

---

### 3.6 下载 SQLite 数据库备份快照
- **URL**：`GET /api/database/backup` (或 `GET /api/admin/database/backup`)
- **鉴权**：老板专属
- **说明**：使用 SQLite 在线无锁热备份（`VACUUM INTO`）生成当前的实时完整数据快照文件，并以文件流形式返回下载。

#### 响应说明
- **Content-Type**: `application/octet-stream`
- **Content-Disposition**: `attachment; filename="hotel_backup_YYYYMMDD_HHmmss.db"`

---

## 4. 每日房费收入上报 (Reports)

### 4.1 提交收入上报记录
- **URL**：`POST /api/reports`
- **鉴权**：需具备 `report` 权限或为老板

#### 请求参数 (Body)
| 字段 | 类型 | 必填 | 规则与说明 |
| :--- | :--- | :---: | :--- |
| `report_date` | String | 是 | 交易日期，格式: `YYYY-MM-DD` |
| `room_number` | String | 是 | 房间编号，如 `"801"`、`"VIP-01"` |
| `amount` | Number | 是 | 收款金额（正数），单位: 美元 ($) |
| `channel` | String | 是 | 收款平台：`CASH` (现金)、`ABA` (ABA银行)、`CRYPTO` (虚拟币USDT)、`WECHAT` (微信)、`OTHER` |

```json
{
  "report_date": "2026-09-27",
  "room_number": "802",
  "amount": 45.00,
  "channel": "ABA"
}
```

#### 响应示例 (`200 OK`)
```json
{
  "id": 105,
  "user_id": 2,
  "user_name": "Sophea",
  "report_date": "2026-09-27",
  "room_number": "802",
  "amount": 45.00,
  "channel": "ABA"
}
```

---

### 4.2 条件查询收入流水列表
- **URL**：`GET /api/reports`
- **鉴权**：需具备 `report` 权限或为老板
- **数据隔离**：普通员工仅能查询自己上报的流水，老板可查询全局员工流水。

#### 查询参数 (Query Parameters)
| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `start_date` | String | 否 | 起始日期筛选，如 `2026-09-01` |
| `end_date` | String | 否 | 截止日期筛选，如 `2026-09-30` |

#### 响应示例 (`200 OK`)
```json
[
  {
    "id": 105,
    "user_id": 2,
    "user_name": "Sophea",
    "report_date": "2026-09-27",
    "shift": "",
    "room_number": "802",
    "amount": 45.00,
    "channel": "ABA",
    "created_at": "2026-09-27 14:15:00"
  }
]
```

---

### 4.3 删除指定收入记录
- **URL**：`DELETE /api/reports/:id`
- **鉴权**：需具备 `report` 权限或为老板
- **安全约束**：员工仅可删除自己创建的记录；老板可删除任意记录。

#### 响应示例 (`200 OK`)
```json
{
  "success": true,
  "message": "Report deleted"
}
```

---

## 5. 经营成本与支出登记 (Expenses)

### 5.1 登记新支出
- **URL**：`POST /api/expenses`
- **鉴权**：需具备 `expense` 权限或为老板

#### 请求参数 (Body)
| 字段 | 类型 | 必填 | 规则与说明 |
| :--- | :--- | :---: | :--- |
| `expense_date` | String | 是 | 支出日期，格式: `YYYY-MM-DD` |
| `category` | String | 是 | 分类：`UTILITIES` (水电)、`RENT` (房租)、`INTERNET` (宽带)、`LAUNDRY` (洗涤)、`SALARY` (工资)、`OTHER` |
| `amount` | Number | 是 | 支出金额（正数），单位: 美元 ($) |
| `description` | String | 否 | 备注说明，如 `"9月份水费账单"` |

```json
{
  "expense_date": "2026-09-25",
  "category": "UTILITIES",
  "amount": 180.50,
  "description": "9月水费账单"
}
```

#### 响应示例 (`200 OK`)
```json
{
  "id": 28,
  "expense_date": "2026-09-25",
  "category": "UTILITIES",
  "amount": 180.50,
  "description": "9月水费账单"
}
```

---

### 5.2 查询支出列表
- **URL**：`GET /api/expenses`
- **鉴权**：需具备 `expense` 权限或为老板

#### 查询参数 (Query Parameters)
| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `month` | String | 否 | 按账期月份查询，格式: `YYYY-MM` (优先匹配) |
| `start_date` | String | 否 | 起始日期筛选，如 `2026-09-01` |
| `end_date` | String | 否 | 截止日期筛选，如 `2026-09-30` |

#### 响应示例 (`200 OK`)
```json
[
  {
    "id": 28,
    "expense_date": "2026-09-25",
    "category": "UTILITIES",
    "amount": 180.50,
    "description": "9月水费账单",
    "created_at": "2026-09-25 10:20:00"
  }
]
```

---

### 5.3 删除指定支出记录
- **URL**：`DELETE /api/expenses/:id`
- **鉴权**：需具备 `expense` 权限或为老板

#### 响应示例 (`200 OK`)
```json
{
  "success": true,
  "message": "Expense deleted"
}
```

---

## 6. 月度统计与经营看板 (Stats)

### 6.1 获取月度收益综合分析数据
- **URL**：`GET /api/stats/monthly`
- **鉴权**：需具备 `stats` 权限或为老板

#### 查询参数 (Query Parameters)
| 参数 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `month` | String | 否 | 统计月份，格式: `YYYY-MM` (未传入则默认为当前月份) |

#### 响应示例 (`200 OK`)
```json
{
  "month": "2026-09",
  "kpi": {
    "totalIncome": 8560.00,
    "totalExpense": 3200.00,
    "netProfit": 5360.00,
    "reportCount": 142
  },
  "dailyIncomeTrend": [
    { "date": "2026-09-01", "amount": 280.00 },
    { "date": "2026-09-02", "amount": 320.00 }
  ],
  "channelBreakdown": [
    { "channel": "CASH", "amount": 2100.00 },
    { "channel": "ABA", "amount": 4200.00 },
    { "channel": "CRYPTO", "amount": 1500.00 },
    { "channel": "WECHAT", "amount": 560.00 },
    { "channel": "OTHER", "amount": 200.00 }
  ],
  "roomIncome": [
    { "room_number": "801", "amount": 1200.00 },
    { "room_number": "802", "amount": 980.00 }
  ],
  "expenseCategoryBreakdown": [
    { "category": "UTILITIES", "amount": 650.00 },
    { "category": "RENT", "amount": 1800.00 },
    { "category": "INTERNET", "amount": 120.00 },
    { "category": "LAUNDRY", "amount": 230.00 },
    { "category": "SALARY", "amount": 400.00 }
  ]
}
```

---

## 💻 cURL 调试调用范例

```bash
# 1. 登录并提取 Token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"boss","password":"boss12345"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

# 2. 查询当前用户信息
curl -s -X GET http://127.0.0.1:8088/api/me \
  -H "Authorization: Bearer $TOKEN"

# 3. 提交一笔收入流水
curl -s -X POST http://127.0.0.1:8088/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report_date":"2026-09-27","room_number":"301","amount":50.00,"channel":"ABA"}'

# 4. 获取 2026 年 9 月度经营统计数据
curl -s -X GET "http://127.0.0.1:8088/api/stats/monthly?month=2026-09" \
  -H "Authorization: Bearer $TOKEN"
```
