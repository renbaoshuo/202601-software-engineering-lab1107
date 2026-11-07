# AGENTS.md

面向 AI 编程助手的项目约定。写代码前先读完本文，与本文冲突的做法一律以本文为准。

## 项目概述

个人记账本（软件工程课程现场编程作业）：记录收支、查看账单、统计分析，数据保存在本地。

技术栈：React 19 + TypeScript + Vite，UI 组件库 Mantine v9（`@mantine/core` + `@mantine/hooks`），图标 `@tabler/icons-react`，路由 `react-router` v8，包管理用 yarn。

## 常用命令

```bash
yarn install   # 安装依赖
yarn dev       # 启动开发服务器
yarn build     # 构建产物（tsc -b && vite build）
yarn lint      # ESLint 检查
```

改完代码跑 `yarn lint` 确认无报错即可，不需要跑构建验证。

## 提交规范

commit 是细粒度的：每完成一个小功能点就 commit 一次，不要攒到整个模块做完才提交。一个页面拆出一个组件、加了一个工具函数、接通一处数据，都各自是一次提交。

commit message 格式为 `feat/fix/chore: {message}`：

- 类型只在这三者中选：新功能 `feat`，修 bug `fix`，杂务（依赖、配置、文档等）`chore`
- `message` 全部小写、用最简单明了的英文（如 `feat: add transaction form`、`fix: calendar date parsing`、`chore: add date-fns`）
- 只写标题一行，不写 description/body

## 目录结构

- `src/main.tsx` — 入口：StrictMode + MantineProvider + BrowserRouter，已引入 `@mantine/core/styles.css`，不要再重复引入
- `src/App.tsx` — 路由表，所有页面挂在 `<AppLayout />` 内
- `src/components/` — 跨页面复用的通用组件（如 `AppLayout` 布局、`PagePlaceholder`）
- `src/pages/` — 页面组件，每个文件默认导出一个函数组件
- `src/shared/` — 公共存储接口（`db.ts`）和共享数据类型（`types.ts`）

## 数据存储约定

- 业务数据统一通过 `src/shared/db.ts` 的接口读写，由 Dexie 保存到当前站点的 IndexedDB。页面复用 `src/shared/types.ts` 的类型。数据库结构集中在 `db.ts`，升级时新增 Dexie 版本并按需迁移已有数据。
- 金额统一用整数分，例如 `1250` 表示 `12.50` 元。账单金额为正数，收支方向由 `type` 区分。账单日期用本地 `YYYY-MM-DD`，预算月份用 `YYYY-MM`。分类是精确匹配的字符串，空备注用 `""`。
- 账单流水、日历、总览和统计共用 `transactions.list(query)`。默认按账单日期降序，日期和金额范围包含端点，关键词匹配分类或备注且忽略大小写。分页用 `offset`、`limit` 和 `transactions.count(filter)`。React 页面用 `dexie-react-hooks` 的 `useLiveQuery` 订阅查询，首次加载时处理 `undefined`。
- `budgets` 按月份保存预算额，使用额按该月支出账单计算。`savingsGoals.deposit(id, amount)` 累加目标的已存金额，与账单独立。`get` 找不到记录时返回 `undefined`，`update` 和 `deposit` 找不到记录时返回 `false`。
- 数据管理页负责 JSON/CSV 文件的解析和校验。`ledgerBackup.read()` 返回完整快照，`ledgerBackup.restore(backup)` 在一个事务中覆盖现有数据。CSV 账单解析成 `NewTransaction[]` 后用 `transactions.addMany` 追加。

## 编码原则

### 1. 优先复用已安装的库，不要自己造轮子

- 能用 Mantine 组件直接满足的，一律用 Mantine：布局用 `AppShell`/`Group`/`Stack`/`Grid`，表单输入用 `TextInput`/`NumberInput`/`Select`/`DatePickerInput`，弹层用 `Modal`/`Drawer`，反馈用 `Notification`/`Alert`，数据展示用 `Table`/`Card`/`Badge`。先查 [Mantine 文档](https://mantine.dev)确认组件存在及其 props，再动手写。
- Mantine 覆盖不到的业务组件（如「账单表单」「分类饼图卡片」），基于 Mantine 组件二次封装，放在 `src/components/`，不要从原生 HTML/CSS 从头实现。
- 图标统一从 `@tabler/icons-react` 引入，不要混入其他图标库或手写 SVG。
- 通用逻辑先看 `@mantine/hooks` 有没有现成的（如 `use-local-storage`、`use-debounced-value`、`use-clipboard`）。

### 2. 工具函数优先引三方库

日期处理、格式化、排序去重这类工具需求，先找 npm 上成熟的三方库（如日期用 `date-fns`，金额格式化用 `currency.js`），用 `yarn add` 安装后再用。只有三方库确实覆盖不到的场景才手写工具函数。

### 3. 命名从简且自描述

函数、变量、组件的命名要短，但要能直接看出它做什么：`formatAmount`、`totalIncome`、`TransactionForm`。不要无意义的缩写（`data1`、`tmp`），也不要冗长堆砌（`getTheTotalAmountOfAllExpenses`）。

### 4. 遵守 React 编程范式

- UI 是状态的映射：用 state/props 驱动视图，条件渲染、列表渲染都用 JSX 表达式完成。
- 禁止用 `document.querySelector`、直接改 `classList`/`style` 这类命令式 DOM 操作来绕过框架。确需访问 DOM 时（聚焦、滚动）用 `ref`，且优先用 Mantine 组件自带的 ref/相关 props。
- 组件拆分以页面为单位，页面内过大的 JSX 块再拆子组件；状态尽量放在离使用处最近的组件，不提前引入 Context/Redux 之类的全局状态方案。

### 5. 不写测试，不过度防御

- 除非用户明确要求，不编写单元测试，不做任何为测试预留的设计（不为测试导出内部函数、不注入 mock 钩子）。
- 不为假想的边界情况写防御代码：不需要对内部数据做层层判空、不需要 try-catch 包住每一段逻辑、不需要处理「正常使用不会到达」的分支。把当前业务需求跑通即可，出现问题时再针对性处理。

### 6. 以实际代码和官方文档为准

不要依赖训练时记住的 API——它们可能已过时（本项目用的 Mantine v9、react-router v8、React 19 都比常见训练语料新）。不确定某个组件的 props、某个库的用法时：

1. 先在项目里 grep 已有代码，跟随现有用法；
2. 再查官方文档（Mantine: https://mantine.dev ，react-router: https://reactrouter.com ，Vite: https://vite.dev ）；
3. 都没有再考虑自己的实现，并在回复中说明依据。

注意本项目的路由 API 从 `react-router` 包导入（`Link`、`Outlet`、`useLocation` 等），不是 `react-router-dom`。

## 代码风格

由 ESLint（`@stylistic`）约束，写代码时直接遵守，不要依赖格式化工具兜底：

- 字符串和 JSX 属性用双引号，语句结尾带分号
- 组件用 `function` 声明并默认导出：`export default function Dashboard() { ... }`
- props 用 `interface XxxProps` 定义
- 注释用中文，解释「为什么」而不是复述代码
