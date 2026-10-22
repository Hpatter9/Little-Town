// The founder's own shops (sim/founderShops.ts): what a shop can stock, and what a price level does. Sim-free data.

export type ShopPrice = 'low' | 'fair' | 'high';
export const SHOP_PRICES: readonly ShopPrice[] = ['low', 'fair', 'high'];

/** A price level: what a sale takes in (the share of its worth), how many customers it draws (added to the shop's
 *  attractiveness) and how the town feels (morale, once a day, for every grown-up). */
export const PRICE_LEVELS: Readonly<Record<ShopPrice, { name: string; sales: number; attract: number; mood: number; text: string }>> = {
  low: { name: 'Low', sales: 0.85, attract: 4, mood: 1, text: 'More customers, a little less on each sale. The town is pleased.' },
  fair: { name: 'Fair', sales: 1, attract: 0, mood: 0, text: 'The usual price.' },
  high: { name: 'High', sales: 1.25, attract: -4, mood: -1, text: 'More on each sale, fewer customers. The town grumbles.' },
};

/** A line of stock: what its sales are worth against the plain ones, and the share of its takings spent on restocking. */
export interface StockLine {
  id: string;
  name: string;
  text: string;
  sales: number;
  cost: number;
}

/** The lines each kind of shop can keep: its venue (`shop`, `tavern`) or its specialty line (data/stores.ts). */
export const STOCK_LINES: Readonly<Record<string, readonly StockLine[]>> = {
  shop: [
    { id: 'everyday', name: 'Everyday goods', text: 'Tools, rope and the plain wares: cheap to stock.', sales: 1, cost: 0.25 },
    { id: 'fine', name: 'Fine wares', text: 'Better made things for the better off: dearer to stock, dearer to sell.', sales: 1.25, cost: 0.45 },
    { id: 'gear', name: 'Gear and weapons', text: 'Arms and kit from the town’s makers: a steady trade.', sales: 1.1, cost: 0.35 },
  ],
  tavern: [
    { id: 'ale', name: 'Ale and bread', text: 'A drink and a plain meal: cheap and quick.', sales: 1, cost: 0.25 },
    { id: 'meals', name: 'Hot meals', text: 'Stews and roasts: the guests stay and spend.', sales: 1.15, cost: 0.4 },
    { id: 'wine', name: 'Wine and rooms', text: 'The best the cellar has, and a good bed: costly, and richly paid.', sales: 1.3, cost: 0.5 },
  ],
  furniture: [
    { id: 'chairs', name: 'Chairs and tables', text: 'Plain joinery that sells all year.', sales: 1, cost: 0.3 },
    { id: 'beds', name: 'Beds and chests', text: 'Big pieces, slow to sell, good money.', sales: 1.2, cost: 0.45 },
  ],
  weapons: [
    { id: 'blades', name: 'Blades', text: 'Knives, swords and axes.', sales: 1, cost: 0.35 },
    { id: 'bows', name: 'Bows and spears', text: 'Hunters and guards buy them steadily.', sales: 1.1, cost: 0.4 },
  ],
  armour: [
    { id: 'mail', name: 'Mail and helms', text: 'Heavy armour for those who can pay.', sales: 1.2, cost: 0.45 },
    { id: 'shields', name: 'Shields and caps', text: 'Plain protection at a fair price.', sales: 1, cost: 0.3 },
  ],
  medicine: [
    { id: 'salves', name: 'Salves and bandages', text: 'What every household wants.', sales: 1, cost: 0.25 },
    { id: 'herbs', name: 'Herbs and tonics', text: 'Cures for the sick: dearer to stock.', sales: 1.2, cost: 0.4 },
  ],
};

/** A manager's day's wage before skill, and what each Social level adds (a share), by purse scale. */
export const MANAGER_WAGE = 2;
export const MANAGER_WAGE_PER_LEVEL = 0.05;
/** A manager's skill against takings: the plain rate, and what each Social level adds (to a most). */
export const MANAGER_BASE = 0.8;
export const MANAGER_PER_LEVEL = 0.012;
export const MANAGER_MOST = 1.2;
/** The founder behind their own counter takes this much on every sale. */
export const SELF_SALES = 1.25;
