-- 初期ジャンルのシードデータ
INSERT INTO metadata_genres (id, display_name, description, icon_image_url, canonical_id, merged_genre_ids, is_active)
VALUES
    ('anime-manga', 'アニメ・漫画', '漫画、アニメ、声優、ライトノベルなどに関するクイズ', NULL, NULL, '{}', true),
    ('game', 'ゲーム', '家庭用ゲーム、スマホアプリ、レトロゲーム、ボードゲーム、eスポーツなどに関するクイズ', NULL, NULL, '{}', true),
    ('music', '音楽', '邦楽、洋楽、アニソン、クラシック、楽器などに関するクイズ', NULL, NULL, '{}', true),
    ('movie-drama', '映画・ドラマ', '国内外の映画、ドラマ、俳優、監督などに関するクイズ', NULL, NULL, '{}', true),
    ('sports', 'スポーツ', '野球、サッカー、テニス、陸上、モータースポーツなどに関するクイズ', NULL, NULL, '{}', true),
    ('geography-travel', '地理・旅行', '世界の国々、日本の都道府県、観光地、特産品などに関するクイズ', NULL, NULL, '{}', true),
    ('history', '歴史', '日本史、世界史、偉人、考古学などに関するクイズ', NULL, NULL, '{}', true),
    ('science-math', '科学・数学', '物理、化学、生物、地学、数学、IT技術などに関するクイズ', NULL, NULL, '{}', true),
    ('language-literature', '言語・文学', 'ことわざ、四字熟語、難読漢字、小説、文学史などに関するクイズ', NULL, NULL, '{}', true),
    ('society-economy', '社会・経済', '時事問題、経済、政治、法律、ビジネスなどに関するクイズ', NULL, NULL, '{}', true),
    ('gourmet', 'グルメ', '料理、食材、スイーツ、お酒、世界の食文化などに関するクイズ', NULL, NULL, '{}', true),
    ('art-culture', '芸術・カルチャー', '絵画、彫刻、建築、落語、演劇、雑学などに関するクイズ', NULL, NULL, '{}', true)
ON CONFLICT (id) DO NOTHING;
