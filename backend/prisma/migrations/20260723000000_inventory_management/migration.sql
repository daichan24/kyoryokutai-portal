-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" TEXT,
    "quantity" DOUBLE PRECISION,
    "quantitySuffix" TEXT,
    "quantityNote" TEXT,
    "expiry" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryUpdate" (
    "id" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryChange" (
    "id" TEXT NOT NULL,
    "updateId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "itemCapacity" TEXT,
    "itemQuantitySuffix" TEXT,
    "category" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'UPDATE',
    "previousQuantity" DOUBLE PRECISION,
    "nextQuantity" DOUBLE PRECISION,
    "previousExpiry" TEXT,
    "nextExpiry" TEXT,

    CONSTRAINT "InventoryChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_category_sortOrder_idx" ON "InventoryItem"("category", "sortOrder");
CREATE INDEX "InventoryUpdate_createdAt_idx" ON "InventoryUpdate"("createdAt");
CREATE INDEX "InventoryUpdate_updatedById_idx" ON "InventoryUpdate"("updatedById");
CREATE INDEX "InventoryChange_updateId_idx" ON "InventoryChange"("updateId");
CREATE INDEX "InventoryChange_itemId_idx" ON "InventoryChange"("itemId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryUpdate" ADD CONSTRAINT "InventoryUpdate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryChange" ADD CONSTRAINT "InventoryChange_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "InventoryUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryChange" ADD CONSTRAINT "InventoryChange_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2026年7月17日時点の初期在庫。品名・容量・表示順は画面から変更しない。
INSERT INTO "InventoryItem" ("id", "category", "name", "capacity", "quantity", "quantitySuffix", "quantityNote", "expiry", "sortOrder", "createdAt", "updatedAt") VALUES
('inv-drink-water', 'DRINKS', '水', '2L', 3, NULL, NULL, '2027/8', 10, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-drink-beer', 'DRINKS', 'ビール', '350ml', 0, NULL, NULL, NULL, 20, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-drink-nonalcohol', 'DRINKS', 'ノンアルビール', '350ml', 0, NULL, NULL, NULL, 30, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-drink-lemon-sour', 'DRINKS', 'レモンサワー', '350ml', 0, NULL, NULL, NULL, 40, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-drink-highball', 'DRINKS', 'ハイボール', '350ml', 0, NULL, NULL, NULL, 50, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),

('inv-food-soy-sauce', 'FOOD', '醤油', '1L', 0, NULL, NULL, NULL, 10, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-salt', 'FOOD', '塩', '1kg', 0.8, NULL, NULL, '賞味期限なし（購入時期不明）', 20, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-oil', 'FOOD', 'サラダ油', '900g', 0, NULL, NULL, NULL, 30, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-mirin', 'FOOD', 'みりん', '1L', 0, NULL, NULL, NULL, 40, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-kuromitsu', 'FOOD', '黒みつ', '180g', 3, NULL, NULL, '2027/6/13 ×2　2027/5/17 ×1', 50, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-starch', 'FOOD', '片栗粉', '700g', 1, NULL, NULL, NULL, 60, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-bouillon', 'FOOD', 'ブイヨン', '7本入', 5, '本', NULL, '2027/3', 70, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-food-bay-leaf', 'FOOD', 'ローリエ', '4g', 1, NULL, NULL, '2027/12', 80, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),

('inv-supply-paper-plate', 'SUPPLIES', '紙皿', NULL, 13, NULL, NULL, NULL, 10, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-chopsticks-wrapped', 'SUPPLIES', '割り箸（袋あり）', NULL, 32, NULL, NULL, NULL, 20, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-chopsticks-loose', 'SUPPLIES', '割り箸（袋なし）', NULL, 168, NULL, NULL, NULL, 30, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-paper-cup-200', 'SUPPLIES', '紙コップ', '200ml', 66, NULL, NULL, NULL, 40, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-paper-cup-250', 'SUPPLIES', '紙コップ', '250ml', 12, NULL, NULL, NULL, 50, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-paper-cup-400', 'SUPPLIES', '紙コップ', '400ml', 8, NULL, NULL, NULL, 60, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-plastic-cup', 'SUPPLIES', 'プラカップ(ふた付)', '375ml', 3, NULL, NULL, NULL, 70, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-cup-lid-large', 'SUPPLIES', 'プラカップふた', '大', 17, NULL, NULL, NULL, 80, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-cup-lid-medium', 'SUPPLIES', 'プラカップふた', '中', 19, NULL, NULL, NULL, 90, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-tissue', 'SUPPLIES', 'ティッシュ', NULL, 1, NULL, NULL, NULL, 100, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-wet-tissue-21', 'SUPPLIES', 'ウェットティッシュ', '21枚入り', 2, NULL, NULL, NULL, 110, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-wet-tissue-18', 'SUPPLIES', 'ウェットティッシュ', '18枚入り', 2, NULL, NULL, NULL, 120, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-straw', 'SUPPLIES', 'ストロー', NULL, 20, NULL, NULL, NULL, 130, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-smoothie-straw', 'SUPPLIES', 'スムージー用ストロー', NULL, 80, NULL, NULL, NULL, 140, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-wood-spoon', 'SUPPLIES', '木スプーン', NULL, 11, NULL, NULL, NULL, 150, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-gloves-120', 'SUPPLIES', 'ポリ手袋', '120枚入り', 1, NULL, NULL, NULL, 160, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-gloves-100', 'SUPPLIES', 'ポリ手袋', '100枚入り', 1, NULL, NULL, NULL, 170, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-oil-solidifier', 'SUPPLIES', '油固めてポン', '10個入り', 1, NULL, NULL, NULL, 180, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-kitchen-towel', 'SUPPLIES', 'キッチンタオル', 'ロール', 2, NULL, NULL, NULL, 190, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-wrap', 'SUPPLIES', 'ラップ', '20m', 1, NULL, '少', NULL, 200, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-supply-cooking-sheet', 'SUPPLIES', 'クッキングシート', NULL, NULL, NULL, NULL, NULL, 210, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),

('inv-bag-semitransparent', 'BAGS', '半透明', '90L(7枚入)', 1, NULL, NULL, NULL, 10, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-food-6', 'BAGS', '指定生ごみ', '6L(10枚入)', 1, NULL, NULL, NULL, 20, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-food-15', 'BAGS', '指定生ごみ', '15L(10枚入)', 1, NULL, NULL, NULL, 30, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-plastic-40', 'BAGS', '指定プラ', '40L', 0, NULL, NULL, NULL, 40, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-can-40', 'BAGS', '指定びん・缶', '40L(10枚入)', 1, NULL, NULL, NULL, 50, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-burnable-40', 'BAGS', '指定可燃', '40L', 0, NULL, NULL, NULL, 60, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-burnable-20', 'BAGS', '指定可燃', '20L(10枚入)', 1, NULL, NULL, NULL, 70, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-nonburnable-30', 'BAGS', '指定不燃', '30L(5枚入)', 1, NULL, NULL, NULL, 80, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-handled-medium', 'BAGS', '持ち手あり', '中', 19, NULL, NULL, NULL, 90, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-bag-handled-small', 'BAGS', '持ち手あり', '小', 12, NULL, NULL, NULL, 100, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),

('inv-other-marker', 'OTHER', '黒マジック（マッキー）', NULL, 1, NULL, NULL, NULL, 10, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-scissors', 'OTHER', 'キッチンハサミ', NULL, 1, NULL, NULL, NULL, 20, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-tongs-large', 'OTHER', 'トング（大）', NULL, 1, NULL, NULL, NULL, 30, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-tongs-small', 'OTHER', 'トング（小）', NULL, 1, NULL, NULL, NULL, 40, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-alcohol-spray', 'OTHER', 'アルコールスプレー', NULL, 1, NULL, NULL, NULL, 50, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-funnel', 'OTHER', 'プラスチックロート', NULL, 1, NULL, NULL, NULL, 60, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-gas', 'OTHER', 'ガス', NULL, 3, '本', NULL, NULL, 70, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-water-dispenser', 'OTHER', '伸縮給水機', NULL, 1, NULL, NULL, NULL, 80, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-stove', 'OTHER', 'カセットコンロ', NULL, 1, NULL, NULL, NULL, 90, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-soup-jar', 'OTHER', 'スープジャー', NULL, 1, NULL, NULL, NULL, 100, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-cooler', 'OTHER', 'クーラーボックス大', NULL, 1, NULL, NULL, NULL, 110, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-banner-smoothie', 'OTHER', 'のぼり（スムージー）', NULL, 1, NULL, NULL, NULL, 120, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-banner-scallop', 'OTHER', 'のぼり（ホタテ）', NULL, 1, NULL, NULL, NULL, 130, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-curtain', 'OTHER', '協力隊のれん', NULL, 1, NULL, NULL, NULL, 140, '2026-07-16 15:00:00', '2026-07-16 15:00:00'),
('inv-other-curtain-rod', 'OTHER', 'のれん棒', NULL, 1, NULL, NULL, NULL, 150, '2026-07-16 15:00:00', '2026-07-16 15:00:00');
