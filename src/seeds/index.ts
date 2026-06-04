/**
 * The DataShop dataset — the same 5 CSVs the data-modeling-notebook course uses.
 * Imported as raw strings at build time (Vite's ?raw suffix) so they ship
 * inlined in the bundle. No fetch, no public/ path, no runtime dependency.
 *
 * Reference numbers (memorize these — every lesson keys off them):
 *   raw_customers       4 rows
 *   raw_products        4 rows
 *   raw_orders          6 rows  (O001..O006, of which O003 is cancelled)
 *   raw_order_items     9 rows
 *   raw_payments        7 rows  (5 paid, 1 refunded, 1 failed)
 *
 *   gross_sales         1060   (excludes cancelled, includes refunded)
 *   paid_revenue        1060   (sum of `paid` payments)
 *   the fan-out trap    1800   (5 paid payments × items = 8 rows, then SUM)
 *   AOV                 212    (1060 / 5 paid orders)
 *   rpt_monthly_sales   2 rows (one per month: 2024-03, 2024-04)
 */

import customersCsv from './raw_customers.csv?raw'
import productsCsv from './raw_products.csv?raw'
import ordersCsv from './raw_orders.csv?raw'
import orderItemsCsv from './raw_order_items.csv?raw'
import paymentsCsv from './raw_payments.csv?raw'

export const DATASHOP_SEEDS: Record<string, string> = {
  raw_customers: customersCsv,
  raw_products: productsCsv,
  raw_orders: ordersCsv,
  raw_order_items: orderItemsCsv,
  raw_payments: paymentsCsv,
}

/** The 5 raw table names, in the order lessons usually introduce them. */
export const DATASHOP_RAW_TABLES = [
  'raw_customers',
  'raw_products',
  'raw_orders',
  'raw_order_items',
  'raw_payments',
] as const
