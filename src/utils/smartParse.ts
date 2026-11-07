import { isValid, subDays } from "date-fns";
import { DEFAULT_CATEGORIES } from "../shared/constants";
import type { TransactionType } from "../shared/types";
import { formatDate, toCents } from "./format";

export interface SmartParseResult {
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  note: string;
}

// 常见口语关键词到默认分类的映射，分类名本身以 constants.ts 为准。
const CATEGORY_WORDS: Record<string, string[]> = {
  饮食: ["早餐", "早饭", "午餐", "午饭", "晚餐", "晚饭", "吃饭", "外卖", "奶茶", "咖啡", "零食", "火锅", "食堂", "餐饮"],
  交通: ["打车", "滴滴", "地铁", "公交", "高铁", "火车", "机票", "油费", "加油", "停车", "出租车"],
  购物: ["淘宝", "京东", "超市", "商场", "衣服", "鞋子", "日用品", "网购"],
  娱乐: ["电影", "游戏", "唱歌", "KTV", "旅游", "门票", "健身", "演出"],
  医疗: ["医院", "看病", "买药", "体检", "挂号", "牙医"],
  居住: ["房租", "水电", "物业", "燃气", "电费", "水费", "家具"],
  工资: ["薪水", "月薪", "发薪", "发工资"],
  奖金: ["年终奖", "红包", "补贴"],
  理财: ["利息", "基金", "股票", "收益", "分红", "理财"],
};

const INCOME_WORDS = [
  "工资", "奖金", ...CATEGORY_WORDS.工资, ...CATEGORY_WORDS.奖金,
  "收入", "进账", "到账", "收到", "赚", "报销", "利息", "收益", "分红",
];

// 先去掉日期表达，避免「11月7日」里的数字被误当成金额。
const DATE_PATTERNS = [
  /\d{4}[年/-]\d{1,2}[月/-]\d{1,2}[日号]?/,
  /\d{1,2}月\d{1,2}[日号]?/,
  /大前天|前天|昨天|昨日|今天|今日/,
];

function parseDateText(text: string): Date {
  const today = new Date();
  if (text.includes("大前天")) return subDays(today, 3);
  if (text.includes("前天")) return subDays(today, 2);
  if (text.includes("昨天") || text.includes("昨日")) return subDays(today, 1);

  const full = text.match(/(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})[日号]?/);
  if (full) {
    const date = new Date(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
    return isValid(date) ? date : today;
  }

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay) {
    const date = new Date(today.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]));
    return isValid(date) ? date : today;
  }

  return today;
}

function parseType(text: string): TransactionType {
  return INCOME_WORDS.some(word => text.includes(word)) ? "income" : "expense";
}

function parseCategory(text: string, type: TransactionType): string {
  const categories = DEFAULT_CATEGORIES[type];
  const direct = categories.find(category => text.includes(category));
  if (direct) return direct;

  return categories.find(category => CATEGORY_WORDS[category]?.some(word => text.includes(word))) ?? "其他";
}

function parseAmount(text: string): number | null {
  const stripped = DATE_PATTERNS.reduce((value, pattern) => value.replace(pattern, " "), text);
  const patterns = [
    /[¥￥]\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*(?:元|块|圆)/,
    /(\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = stripped.match(pattern);
    if (match) {
      const yuan = Number.parseFloat(match[1]);
      if (Number.isFinite(yuan) && yuan > 0) {
        return toCents(Math.round(yuan * 100) / 100);
      }
    }
  }

  return null;
}

// 识别一句话里的收支类型、金额、分类和日期；识别不到金额就返回 null，由表单提示用户。
export function parseTransactionText(text: string): SmartParseResult | null {
  const input = text.trim();
  if (!input) return null;

  const amount = parseAmount(input);
  if (amount === null) return null;

  const type = parseType(input);
  return {
    type,
    amount,
    category: parseCategory(input, type),
    date: formatDate(parseDateText(input)),
    note: input,
  };
}
