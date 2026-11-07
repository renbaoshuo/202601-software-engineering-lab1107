import type { TransactionType } from "./types";

// 默认分类的唯一出处：账单表单的分类选择器、筛选下拉都从这里取，
// 不要在页面里自造分类文案，否则各页统计口径对不上。
// 数据里的 category 仍是任意字符串（CSV 导入可能带外来分类），
// 这份清单只约束录入入口与默认展示。
export const DEFAULT_CATEGORIES: Record<TransactionType, string[]> = {
  expense: ["饮食", "交通", "购物", "娱乐", "医疗", "居住", "其他"],
  income: ["工资", "奖金", "理财", "其他"],
};
