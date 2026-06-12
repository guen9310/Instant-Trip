import Database from 'better-sqlite3';
import type { Database as Db } from 'better-sqlite3';
import type { TourItem } from '@/lib/tour/types';
import type { TagKey, PlaceWithTags } from '@/lib/pipeline/types';
import { applyMappingRules } from '@/lib/pipeline/stage4-scoring';
import { DDL } from '@/lib/db/schema';
import { isCacheEnabled } from '@/lib/config';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

// 위경도를 0.1도 단위로 반올림하여 area_key 생성 (약 8~11km 격자)
export function getAreaKey(lat: number, lng: number, radiusKm: number): string {
  const roundedLat = Math.round(lat * 10) / 10;
  const roundedLng = Math.round(lng * 10) / 10;
  return `lat:${roundedLat}_lng:${roundedLng}_radius:${radiusKm}`;
}

export class PlaceStore {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.db.exec(DDL);
  }

  isCacheValid(areaKey: string): boolean {
    if (!isCacheEnabled()) return false;
    const row = this.db.prepare(
      `SELECT synced_at FROM area_sync_log WHERE area_key = ?`,
    ).get(areaKey) as { synced_at: string } | undefined;

    if (!row) return false;
    return Date.now() - new Date(row.synced_at).getTime() < TTL_MS;
  }

  // Tour API 결과를 DB에 저장하고 tag_scores를 사전 계산한다.
  // is_override=TRUE인 수동 보정 태그는 덮어쓰지 않는다.
  upsertPlaces(areaKey: string, items: TourItem[]): void {
    const insertPlace = this.db.prepare(`
      INSERT INTO places (
        contentid, title, addr1, addr2, mapx, mapy, contenttypeid,
        cat1, cat2, cat3, areacode, sigungucode,
        lclsSystm1, lclsSystm2, lclsSystm3,
        firstimage, firstimage2, tel, createdtime, modifiedtime,
        is_active, last_synced_at
      ) VALUES (
        @contentid, @title, @addr1, @addr2, @mapx, @mapy, @contenttypeid,
        @cat1, @cat2, @cat3, @areacode, @sigungucode,
        @lclsSystm1, @lclsSystm2, @lclsSystm3,
        @firstimage, @firstimage2, @tel, @createdtime, @modifiedtime,
        1, @last_synced_at
      )
      ON CONFLICT(contentid) DO UPDATE SET
        title          = excluded.title,
        addr1          = excluded.addr1,
        mapx           = excluded.mapx,
        mapy           = excluded.mapy,
        firstimage     = excluded.firstimage,
        is_active      = 1,
        last_synced_at = excluded.last_synced_at
    `);

    const deleteAutoTags = this.db.prepare(
      `DELETE FROM place_tags WHERE contentid = ? AND is_override = 0`,
    );

    const insertTag = this.db.prepare(`
      INSERT INTO place_tags (contentid, tag, score, is_override)
      VALUES (@contentid, @tag, @score, 0)
      ON CONFLICT(contentid, tag) DO UPDATE SET score = excluded.score
      WHERE is_override = 0
    `);

    const insertAreaMap = this.db.prepare(
      `INSERT OR IGNORE INTO area_place_map (area_key, contentid) VALUES (?, ?)`,
    );

    const deactivateMissing = this.db.prepare(`
      UPDATE places SET is_active = 0
      WHERE contentid IN (
        SELECT contentid FROM area_place_map WHERE area_key = ?
      )
      AND contentid NOT IN (SELECT value FROM json_each(?))
    `);

    const upsertSyncLog = this.db.prepare(`
      INSERT INTO area_sync_log (area_key, synced_at, place_count)
      VALUES (?, ?, ?)
      ON CONFLICT(area_key) DO UPDATE SET
        synced_at   = excluded.synced_at,
        place_count = excluded.place_count
    `);

    const now = new Date().toISOString();
    const freshIds = items.map((i) => i.contentid);

    this.db.transaction(() => {
      for (const item of items) {
        insertPlace.run({
          ...item,
          lclsSystm1:  item.lclsSystm1  ?? '',
          lclsSystm2:  item.lclsSystm2  ?? '',
          lclsSystm3:  item.lclsSystm3  ?? '',
          last_synced_at: now,
        });

        deleteAutoTags.run(item.contentid);

        const tagScores = applyMappingRules(item);
        for (const [tag, score] of Object.entries(tagScores)) {
          insertTag.run({ contentid: item.contentid, tag, score });
        }

        insertAreaMap.run(areaKey, item.contentid);
      }

      deactivateMissing.run(areaKey, JSON.stringify(freshIds));
      upsertSyncLog.run(areaKey, now, items.length);
    })();
  }

  // Bounding Box로 후보 장소를 조회하고 tag_scores를 함께 반환한다.
  // 정확한 반경 필터링(Haversine)은 stage4 진입 전에 애플리케이션에서 수행한다.
  queryPlacesWithTags(lat: number, lng: number, radiusKm: number): PlaceWithTags[] {
    // 한국 기준: 위도 1° ≈ 111km, 경도 1° ≈ 88km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / 88;

    const places = this.db.prepare(`
      SELECT * FROM places
      WHERE is_active = 1
        AND CAST(mapy AS REAL) BETWEEN ? AND ?
        AND CAST(mapx  AS REAL) BETWEEN ? AND ?
    `).all(
      lat - latDelta, lat + latDelta,
      lng - lngDelta, lng + lngDelta,
    ) as TourItem[];

    if (places.length === 0) return [];

    const placeholders = places.map(() => '?').join(',');
    const tagRows = this.db.prepare(`
      SELECT contentid, tag, score
      FROM place_tags
      WHERE contentid IN (${placeholders})
    `).all(...places.map((p) => p.contentid)) as Array<{
      contentid: string;
      tag: string;
      score: number;
    }>;

    const tagMap = new Map<string, Record<TagKey, number>>();
    for (const { contentid, tag, score } of tagRows) {
      if (!tagMap.has(contentid)) tagMap.set(contentid, {} as Record<TagKey, number>);
      tagMap.get(contentid)![tag as TagKey] = score;
    }

    return places.map((p) => ({
      ...p,
      tagScores: tagMap.get(p.contentid) ?? ({} as Record<TagKey, number>),
    }));
  }

  stats(): { places: number; tags: number; areas: number } {
    const places = (this.db.prepare(`SELECT COUNT(*) AS n FROM places WHERE is_active = 1`).get() as { n: number }).n;
    const tags   = (this.db.prepare(`SELECT COUNT(*) AS n FROM place_tags`).get() as { n: number }).n;
    const areas  = (this.db.prepare(`SELECT COUNT(*) AS n FROM area_sync_log`).get() as { n: number }).n;
    return { places, tags, areas };
  }

  syncLog(): Array<{ area_key: string; synced_at: string; place_count: number }> {
    return this.db.prepare(
      `SELECT area_key, synced_at, place_count FROM area_sync_log ORDER BY synced_at DESC`,
    ).all() as Array<{ area_key: string; synced_at: string; place_count: number }>;
  }
}

// in-memory SQLite 싱글턴 (향후 Neon 전환 시 이 파일만 교체)
export const placeStore = new PlaceStore(new Database(':memory:'));
