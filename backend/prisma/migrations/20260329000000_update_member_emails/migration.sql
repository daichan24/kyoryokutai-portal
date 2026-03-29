-- 隊員・関係者のメールを正式アドレスに更新
-- ・同名が複数いる場合は最古の1件のみ更新（createdAt 昇順で先頭）
-- ・目標メールが「別ユーザー」に既にある場合はスキップ（UNIQUE 違反を防ぐ）

-- 高田和孝
UPDATE "User" u SET email = 'kazutaka-takada@ad.maoi-net.jp'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '高田和孝' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'kazutaka-takada@ad.maoi-net.jp' AND ox.id <> u.id);

-- 牧野栞里
UPDATE "User" u SET email = 's-makino@ad.maoi-net.jp'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '牧野栞里' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 's-makino@ad.maoi-net.jp' AND ox.id <> u.id);

-- 坂本一志
UPDATE "User" u SET email = 'katz.sakamoto.2019@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '坂本一志' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'katz.sakamoto.2019@gmail.com' AND ox.id <> u.id);

-- 江藤誠洋
UPDATE "User" u SET email = 'm.eto.4110@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '江藤誠洋' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'm.eto.4110@gmail.com' AND ox.id <> u.id);

-- 徳留正也
UPDATE "User" u SET email = 'tokudomese@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '徳留正也' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'tokudomese@gmail.com' AND ox.id <> u.id);

-- 金山真大
UPDATE "User" u SET email = 'jinshanzhenda@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '金山真大' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'jinshanzhenda@gmail.com' AND ox.id <> u.id);

-- 兼松成伍
UPDATE "User" u SET email = 'seigo140707@icloud.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '兼松成伍' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'seigo140707@icloud.com' AND ox.id <> u.id);

-- 曹冠宇
UPDATE "User" u SET email = 'caoguanyu1@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '曹冠宇' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'caoguanyu1@gmail.com' AND ox.id <> u.id);

-- 有馬圭亮
UPDATE "User" u SET email = 'maoi.arima@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '有馬圭亮' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'maoi.arima@gmail.com' AND ox.id <> u.id);

-- 田中奈都子
UPDATE "User" u SET email = 'nacchandeli@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '田中奈都子' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'nacchandeli@gmail.com' AND ox.id <> u.id);

-- 岡田彩葵
UPDATE "User" u SET email = 'sakioam1102@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '岡田彩葵' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'sakioam1102@gmail.com' AND ox.id <> u.id);

-- 小川紗綾佳
UPDATE "User" u SET email = 'sayaka.nice.music@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '小川紗綾佳' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'sayaka.nice.music@gmail.com' AND ox.id <> u.id);

-- 前野寿美麗
UPDATE "User" u SET email = 'maoisumire@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '前野寿美麗' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'maoisumire@gmail.com' AND ox.id <> u.id);

-- 中村来実
UPDATE "User" u SET email = 'maoi.lamy@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '中村来実' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = 'maoi.lamy@gmail.com' AND ox.id <> u.id);

-- 佐藤大地
UPDATE "User" u SET email = '1st.writing12@gmail.com'
WHERE u.id = (SELECT u2.id FROM "User" u2 WHERE u2.name = '佐藤大地' ORDER BY u2."createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" ox WHERE ox.email = '1st.writing12@gmail.com' AND ox.id <> u.id);
