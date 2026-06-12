export const DDL = `
  CREATE TABLE IF NOT EXISTS places (
    contentid      TEXT PRIMARY KEY,
    title          TEXT NOT NULL DEFAULT '',
    addr1          TEXT NOT NULL DEFAULT '',
    addr2          TEXT NOT NULL DEFAULT '',
    mapx           TEXT NOT NULL DEFAULT '',
    mapy           TEXT NOT NULL DEFAULT '',
    contenttypeid  TEXT NOT NULL DEFAULT '',
    cat1           TEXT NOT NULL DEFAULT '',
    cat2           TEXT NOT NULL DEFAULT '',
    cat3           TEXT NOT NULL DEFAULT '',
    areacode       TEXT NOT NULL DEFAULT '',
    sigungucode    TEXT NOT NULL DEFAULT '',
    lclsSystm1     TEXT NOT NULL DEFAULT '',
    lclsSystm2     TEXT NOT NULL DEFAULT '',
    lclsSystm3     TEXT NOT NULL DEFAULT '',
    firstimage     TEXT NOT NULL DEFAULT '',
    firstimage2    TEXT NOT NULL DEFAULT '',
    tel            TEXT NOT NULL DEFAULT '',
    createdtime    TEXT NOT NULL DEFAULT '',
    modifiedtime   TEXT NOT NULL DEFAULT '',
    is_active      INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT
  );

  CREATE TABLE IF NOT EXISTS place_tags (
    contentid   TEXT NOT NULL REFERENCES places(contentid),
    tag         TEXT NOT NULL,
    score       REAL NOT NULL,
    is_override INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contentid, tag)
  );

  CREATE TABLE IF NOT EXISTS area_sync_log (
    area_key    TEXT PRIMARY KEY,
    synced_at   TEXT NOT NULL,
    place_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS area_place_map (
    area_key  TEXT NOT NULL,
    contentid TEXT NOT NULL REFERENCES places(contentid),
    PRIMARY KEY (area_key, contentid)
  );

`;
