/**
 * Catalogue seed data. Fixed slugs, fixed prices and fixed stock levels: the test
 * suite asserts on exact values, so nothing here may be randomised.
 *
 * Stock levels are deliberately spread across the interesting boundaries: several
 * variants sit at exactly 0 (out of stock), several at exactly 1 (last unit), and
 * two products have every variant at 0 so the out-of-stock badge can be exercised.
 */

export interface SeedVariant {
  name: string;
  sku: string;
  priceCents: number;
  stockQty: number;
}

export interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  category: 'electronics' | 'home-kitchen' | 'fashion';
  basePriceCents: number;
  variants: SeedVariant[];
}

export const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Fashion', slug: 'fashion' },
] as const;

export const PRODUCTS: SeedProduct[] = [
  // Electronics
  {
    name: 'Anker Soundcore Life Q30 Headphones',
    slug: 'anker-soundcore-life-q30-headphones',
    description:
      'Over-ear wireless headphones with hybrid active noise cancelling and 40 hours of playtime on a single charge. Folds flat for commuting and ships with a hard carry case.',
    category: 'electronics',
    basePriceCents: 1_099_000,
    variants: [
      { name: 'Midnight Black', sku: 'ELEC-Q30-BLK', priceCents: 1_099_000, stockQty: 14 },
      { name: 'Navy Blue', sku: 'ELEC-Q30-NVY', priceCents: 1_149_000, stockQty: 6 },
    ],
  },
  {
    name: 'Xiaomi Redmi Note 13 Smartphone',
    slug: 'xiaomi-redmi-note-13-smartphone',
    description:
      'A 6.67-inch AMOLED display at 120Hz, a 108MP main camera and a 5000mAh battery that holds a full day of heavy use. Dual SIM, unlocked for all Kenyan networks.',
    category: 'electronics',
    basePriceCents: 2_450_000,
    variants: [
      { name: '128GB / Graphite', sku: 'ELEC-RN13-128G', priceCents: 2_450_000, stockQty: 9 },
      { name: '256GB / Graphite', sku: 'ELEC-RN13-256G', priceCents: 2_890_000, stockQty: 4 },
      { name: '256GB / Ice Blue', sku: 'ELEC-RN13-256B', priceCents: 2_890_000, stockQty: 1 },
    ],
  },
  {
    name: 'Logitech MX Master 3S Mouse',
    slug: 'logitech-mx-master-3s-mouse',
    description:
      'Precision wireless mouse with an 8000 DPI sensor and near-silent clicks. Pairs with three machines at once and switches between them with a button on the base.',
    category: 'electronics',
    basePriceCents: 1_380_000,
    variants: [{ name: 'Graphite', sku: 'ELEC-MX3S-GRA', priceCents: 1_380_000, stockQty: 11 }],
  },
  {
    name: 'Samsung T7 Portable SSD 1TB',
    slug: 'samsung-t7-portable-ssd-1tb',
    description:
      'Pocket-sized USB 3.2 drive reading at up to 1050 MB/s. Shock-resistant to two metres and no larger than a credit card.',
    category: 'electronics',
    basePriceCents: 1_295_000,
    variants: [
      { name: '1TB / Titan Grey', sku: 'ELEC-T7-1TB-GRY', priceCents: 1_295_000, stockQty: 7 },
      { name: '2TB / Titan Grey', sku: 'ELEC-T7-2TB-GRY', priceCents: 2_190_000, stockQty: 0 },
    ],
  },
  {
    name: 'JBL Flip 6 Bluetooth Speaker',
    slug: 'jbl-flip-6-bluetooth-speaker',
    description:
      'Rugged portable speaker rated IP67 for dust and water. Twelve hours of playback and a racetrack driver that holds the low end at volume.',
    category: 'electronics',
    basePriceCents: 1_650_000,
    variants: [
      { name: 'Black', sku: 'ELEC-FLIP6-BLK', priceCents: 1_650_000, stockQty: 5 },
      { name: 'Teal', sku: 'ELEC-FLIP6-TEA', priceCents: 1_650_000, stockQty: 1 },
    ],
  },
  {
    name: 'Oraimo 20000mAh Power Bank',
    slug: 'oraimo-20000mah-power-bank',
    description:
      'Twenty-watt fast charging over USB-C with three output ports. Charges a typical phone four times over before it needs topping up itself.',
    category: 'electronics',
    basePriceCents: 345_000,
    variants: [{ name: 'Black', sku: 'ELEC-OR20K-BLK', priceCents: 345_000, stockQty: 23 }],
  },
  {
    name: 'TP-Link Archer AX23 Wi-Fi 6 Router',
    slug: 'tp-link-archer-ax23-wifi-6-router',
    description:
      'Dual-band Wi-Fi 6 router pushing 1.8 Gbps across four antennas. Handles a busy household of phones, laptops and smart devices without stalling.',
    category: 'electronics',
    basePriceCents: 785_000,
    variants: [{ name: 'Standard', sku: 'ELEC-AX23-STD', priceCents: 785_000, stockQty: 8 }],
  },
  {
    name: 'Amazfit Bip 5 Smartwatch',
    slug: 'amazfit-bip-5-smartwatch',
    description:
      'A 1.91-inch display with built-in GPS, heart-rate and SpO2 tracking, and ten days of battery between charges. Takes calls over Bluetooth.',
    category: 'electronics',
    basePriceCents: 920_000,
    variants: [
      { name: 'Soft Black', sku: 'ELEC-BIP5-BLK', priceCents: 920_000, stockQty: 0 },
      { name: 'Cream White', sku: 'ELEC-BIP5-CRM', priceCents: 920_000, stockQty: 0 },
    ],
  },
  {
    name: 'HP 245 G9 Laptop Ryzen 5',
    slug: 'hp-245-g9-laptop-ryzen-5',
    description:
      'A 14-inch business laptop on a Ryzen 5 5625U with 8GB of RAM and a 512GB NVMe drive. Weighs 1.47kg and charges over USB-C.',
    category: 'electronics',
    basePriceCents: 6_850_000,
    variants: [
      { name: '8GB / 512GB', sku: 'ELEC-HP245-8512', priceCents: 6_850_000, stockQty: 3 },
      { name: '16GB / 512GB', sku: 'ELEC-HP245-16512', priceCents: 7_900_000, stockQty: 1 },
    ],
  },

  // Home & Kitchen
  {
    name: 'Ramtons 2-Burner Gas Cooker',
    slug: 'ramtons-2-burner-gas-cooker',
    description:
      'Tabletop cooker in enamelled steel with cast-iron pan supports and automatic ignition on both burners. Sized for a small kitchen or a bedsitter.',
    category: 'home-kitchen',
    basePriceCents: 645_000,
    variants: [{ name: 'Stainless', sku: 'HOME-RMT2B-STL', priceCents: 645_000, stockQty: 12 }],
  },
  {
    name: 'Nunix 1.8L Electric Kettle',
    slug: 'nunix-1-8l-electric-kettle',
    description:
      'Cordless stainless kettle with a concealed element and automatic shut-off when it reaches the boil or runs dry.',
    category: 'home-kitchen',
    basePriceCents: 185_000,
    variants: [{ name: 'Brushed Steel', sku: 'HOME-NX18-STL', priceCents: 185_000, stockQty: 31 }],
  },
  {
    name: 'Tefal Non-Stick Frying Pan',
    slug: 'tefal-non-stick-frying-pan',
    description:
      'Hard-base aluminium pan with the Thermo-Spot indicator that turns solid red at the right cooking temperature. Safe for all hobs except induction.',
    category: 'home-kitchen',
    basePriceCents: 295_000,
    variants: [
      { name: '24cm', sku: 'HOME-TEF-24', priceCents: 245_000, stockQty: 16 },
      { name: '28cm', sku: 'HOME-TEF-28', priceCents: 295_000, stockQty: 10 },
    ],
  },
  {
    name: 'Von Hotpoint Microwave Oven 20L',
    slug: 'von-hotpoint-microwave-oven-20l',
    description:
      'A 700-watt solo microwave with a 20-litre cavity, five power levels and a 35-minute mechanical timer. No menus to learn.',
    category: 'home-kitchen',
    basePriceCents: 1_120_000,
    variants: [{ name: 'White', sku: 'HOME-VON20-WHT', priceCents: 1_120_000, stockQty: 0 }],
  },
  {
    name: 'Sufuria Set of 4 Heavy Aluminium',
    slug: 'sufuria-set-of-4-heavy-aluminium',
    description:
      'Four nesting sufurias in thick-gauge aluminium with matching lids, from two to eight litres. The workhorse of a Kenyan kitchen.',
    category: 'home-kitchen',
    basePriceCents: 420_000,
    variants: [{ name: '4-Piece Set', sku: 'HOME-SUF4-ALU', priceCents: 420_000, stockQty: 18 }],
  },
  {
    name: 'Signature Cotton Bedsheet Set',
    slug: 'signature-cotton-bedsheet-set',
    description:
      'Two hundred thread count cotton percale: one flat sheet, one fitted sheet and two pillowcases. Softens with every wash.',
    category: 'home-kitchen',
    basePriceCents: 380_000,
    variants: [
      { name: '4x6 / Sage', sku: 'HOME-BED46-SAG', priceCents: 380_000, stockQty: 9 },
      { name: '5x6 / Sage', sku: 'HOME-BED56-SAG', priceCents: 440_000, stockQty: 7 },
      { name: '6x6 / Charcoal', sku: 'HOME-BED66-CHR', priceCents: 520_000, stockQty: 1 },
    ],
  },
  {
    name: 'Hamilton Beach Blender 1.4L',
    slug: 'hamilton-beach-blender-1-4l',
    description:
      'Seven hundred watts through a four-point stainless blade, with a glass jar that goes in the dishwasher. Crushes ice without stalling.',
    category: 'home-kitchen',
    basePriceCents: 675_000,
    variants: [{ name: 'Black', sku: 'HOME-HB14-BLK', priceCents: 675_000, stockQty: 6 }],
  },
  {
    name: 'Thermos Stainless Flask 1L',
    slug: 'thermos-stainless-flask-1l',
    description:
      'Vacuum-insulated flask that holds tea hot for twelve hours and cold for twenty-four. The stopper pours without being removed.',
    category: 'home-kitchen',
    basePriceCents: 225_000,
    variants: [
      { name: 'Matte Black', sku: 'HOME-THM1L-BLK', priceCents: 225_000, stockQty: 14 },
      { name: 'Steel', sku: 'HOME-THM1L-STL', priceCents: 225_000, stockQty: 0 },
    ],
  },
  {
    name: 'Bamboo Chopping Board Set',
    slug: 'bamboo-chopping-board-set',
    description:
      'Three boards in pressed bamboo with juice grooves and carry handles. Kinder to knife edges than plastic and naturally antibacterial.',
    category: 'home-kitchen',
    basePriceCents: 165_000,
    variants: [{ name: '3-Piece Set', sku: 'HOME-BAM3-NAT', priceCents: 165_000, stockQty: 22 }],
  },

  // Fashion
  {
    name: 'Maasai Beaded Leather Sandals',
    slug: 'maasai-beaded-leather-sandals',
    description:
      'Hand-beaded open sandals on a leather sole, made by artisans in Kajiado. Every pair differs slightly in the beadwork.',
    category: 'fashion',
    basePriceCents: 285_000,
    variants: [
      { name: 'UK 6 / Red', sku: 'FASH-MAAS-6R', priceCents: 285_000, stockQty: 5 },
      { name: 'UK 8 / Red', sku: 'FASH-MAAS-8R', priceCents: 285_000, stockQty: 3 },
      { name: 'UK 9 / Blue', sku: 'FASH-MAAS-9B', priceCents: 285_000, stockQty: 1 },
    ],
  },
  {
    name: 'Kitenge Print Wrap Dress',
    slug: 'kitenge-print-wrap-dress',
    description:
      'A true wrap in wax-print cotton, cut to fall below the knee with a tie waist that suits most shapes. Lined bodice.',
    category: 'fashion',
    basePriceCents: 395_000,
    variants: [
      { name: 'S / Indigo', sku: 'FASH-KTWD-S-IND', priceCents: 395_000, stockQty: 8 },
      { name: 'M / Indigo', sku: 'FASH-KTWD-M-IND', priceCents: 395_000, stockQty: 6 },
      { name: 'L / Ochre', sku: 'FASH-KTWD-L-OCH', priceCents: 395_000, stockQty: 0 },
    ],
  },
  {
    name: 'Premium Cotton Crew T-Shirt',
    slug: 'premium-cotton-crew-t-shirt',
    description:
      'Two hundred gram combed cotton with a ribbed collar that holds its shape. Pre-shrunk, so the size you buy is the size it stays.',
    category: 'fashion',
    basePriceCents: 145_000,
    variants: [
      { name: 'M / White', sku: 'FASH-CREW-M-WHT', priceCents: 145_000, stockQty: 25 },
      { name: 'L / White', sku: 'FASH-CREW-L-WHT', priceCents: 145_000, stockQty: 20 },
      { name: 'L / Black', sku: 'FASH-CREW-L-BLK', priceCents: 145_000, stockQty: 12 },
      { name: 'XL / Black', sku: 'FASH-CREW-XL-BLK', priceCents: 155_000, stockQty: 1 },
    ],
  },
  {
    name: 'Slim Fit Chino Trousers',
    slug: 'slim-fit-chino-trousers',
    description:
      'Cotton twill with a touch of elastane so they give when you sit. Finished with a curved waistband that resists gaping.',
    category: 'fashion',
    basePriceCents: 320_000,
    variants: [
      { name: '32 / Khaki', sku: 'FASH-CHIN-32-KHA', priceCents: 320_000, stockQty: 10 },
      { name: '34 / Khaki', sku: 'FASH-CHIN-34-KHA', priceCents: 320_000, stockQty: 9 },
      { name: '34 / Navy', sku: 'FASH-CHIN-34-NVY', priceCents: 320_000, stockQty: 0 },
    ],
  },
  {
    name: 'Canvas Weekend Duffel Bag',
    slug: 'canvas-weekend-duffel-bag',
    description:
      'Forty litres of waxed canvas with leather trim and a detachable shoulder strap. Fits the overhead locker on a domestic flight.',
    category: 'fashion',
    basePriceCents: 575_000,
    variants: [
      { name: 'Olive', sku: 'FASH-DUFF-OLV', priceCents: 575_000, stockQty: 4 },
      { name: 'Tan', sku: 'FASH-DUFF-TAN', priceCents: 575_000, stockQty: 2 },
    ],
  },
  {
    name: 'Leather Bifold Wallet',
    slug: 'leather-bifold-wallet',
    description:
      'Full-grain leather with six card slots, a note compartment and a coin pocket that actually closes. Stitched, not glued.',
    category: 'fashion',
    basePriceCents: 210_000,
    variants: [
      { name: 'Brown', sku: 'FASH-WALL-BRN', priceCents: 210_000, stockQty: 15 },
      { name: 'Black', sku: 'FASH-WALL-BLK', priceCents: 210_000, stockQty: 13 },
    ],
  },
  {
    name: 'Aviator Polarised Sunglasses',
    slug: 'aviator-polarised-sunglasses',
    description:
      'Polarised grey lenses in a lightweight metal frame with silicone nose pads. Cuts glare off tarmac and water.',
    category: 'fashion',
    basePriceCents: 175_000,
    variants: [{ name: 'Gold / Grey', sku: 'FASH-AVIA-GLD', priceCents: 175_000, stockQty: 1 }],
  },
];
