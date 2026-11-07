# 账单查询模块

对应 Issue #1。本分支提供查询组件、条件转换与数据库订阅，统一复用团队的 Dexie 接口和 `src/shared/types.ts`。账单页面与结果列表由账单流水负责人接入，本分支不包含页面或路由改动。

## 页面入口

```sh
yarn install --frozen-lockfile
yarn dev
```

组件按下方示例接入团队的 `/transactions` 页面后，通过左侧“账单”菜单进入。单独拉取本分支时，已有账单页面仍是团队的占位页面，需要先完成接入才能使用查询界面。

数据来自当前浏览器、当前站点的 IndexedDB（`personal-ledger`），首次使用没有账单时显示空结果；页面不会自动插入示例账单。端口、域名或浏览器不同，账本数据也彼此独立。JSON/CSV 导入导出由数据管理模块负责。

## 数据约定

共享类型为 `Transaction`，示例：

```json
{
  "id": "bill-001",
  "type": "expense",
  "date": "2026-11-07",
  "amount": 2850,
  "category": "饮食",
  "note": "午餐"
}
```

- 数据库金额为**整数分**，`2850` 表示 `28.50` 元。查询输入以元填写，使用 `currency.js` 换算为分；账单列表展示由队友统一调用 `src/utils/format.ts` 的 `formatAmount`。
- 日期为本地 `YYYY-MM-DD`，类型为 `income` 或 `expense`，备注为空时为 `""`。
- 未填写的查询条件转成 `undefined`，不会把 `""` 传入数据库范围查询；金额 `0` 保留为有效条件。
- 日期和金额包含区间端点，多个条件取交集。类别精确匹配；关键词匹配**类别或备注**，忽略首尾空白和英文大小写。

## 文件与职责

| 文件 | 职责 |
| --- | --- |
| `src/components/TransactionQuery.tsx` | 查询表单、输入校验提示、查询和重置按钮 |
| `src/utils/transactionQuery.ts` | 表单校验，将用户输入转换为 `TransactionFilter` |
| `src/hooks/useTransactionQuery.ts` | `useLiveQuery` 订阅数据库查询，返回分页结果、匹配数、总数、类别和加载错误 |

`src/shared/db.ts` 和 `src/shared/types.ts` 为组长维护的共享接口，本模块直接复用。默认分类从 `src/shared/constants.ts` 读取，同时保留历史账单中的自定义分类。数据库结构和骨架文件没有修改。

## 与账单流水模块协作

```tsx
const [filter, setFilter] = useState<TransactionFilter>({});
const [page, setPage] = useState(1);
const result = useTransactionQuery(filter, page);

<TransactionQuery
  categories={result?.categories ?? []}
  onSearch={(nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  }}
/>
```

`onSearch` 只提交有效的 `TransactionFilter`；重置提交 `{}`。队友可复用查询组件，保留自己编写的账单列表，将 `result.records` 用于展示；`result.count` 用于分页，`result.page/pages` 为有效页码和页数。

调用 `transactions.list({ ...filter, sortBy: "date", order: "desc", offset, limit })` 查询结果，用 `transactions.count(filter)` 查询匹配总数。筛选先于分页，修改查询后回到第一页；新增、编辑、删除或导入账单后，通过 Dexie 写入即可自动刷新结果。若末页记录被删除，查询自动收敛到有效页。

类别选项合并团队统一的 `DEFAULT_CATEGORIES` 与已有账单的自定义类别，不受当前分页或筛选结果限制。队友也可直接把统一类别配置作为 `categories` 传入表单。

首次查询的 `undefined` 显示加载提示；数据库读取失败时显示错误提示；没有匹配账单时显示“暂无符合条件的账单”。输入不合法时保留上次已应用的查询。

## 验收步骤

1. 使用录入或导入模块准备账单，金额存整数分；确认 `2850` 显示为 `28.50` 元。
2. 输入相同的开始和结束日期，检查当天记录仍被包含。
3. 组合日期、收支类型、类别、金额范围和关键词，确认结果满足全部条件。
4. 输入只出现在类别中的关键词，也能查询到对应记录；英文关键词不区分大小写。
5. 最低金额大于最高金额，或开始日期晚于结束日期，点击查询显示错误。
6. 查询不存在的关键词显示空结果；重置后恢复全部账单并回到第一页。
7. 准备超过 10 条记录，验证匹配总数与分页；新增、编辑、删除后验证自动刷新。
8. 执行 `yarn lint` 和 `yarn typecheck` 检查代码规范和类型。

本模块额外补齐 `y-dexie` 和 `yjs` 开发依赖，原因是当前 `dexie-react-hooks` 的类型声明引用了这两个包。安装依赖时请一并保留 `package.json` 和 `yarn.lock` 中对应改动。
