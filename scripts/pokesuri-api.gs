/**
 * =========================================================
 * ポケスリ相場ナビ
 * 新スプレッドシート専用API
 * =========================================================
 *
 * 使用シート
 *
 * master
 * weekly
 * monthly
 * yearly
 *
 * サイトへの返却形式
 *
 * {
 *   sleeves: [...]
 * }
 *
 * =========================================================
 */


/**
 * =========================================================
 * 設定
 * =========================================================
 *
 * ★ 新しく作ったスプレッドシートのIDを入れる
 *
 * https://docs.google.com/spreadsheets/d/【ここ】/edit
 */

const SPREADSHEET_ID = "1yhFVkboykdcd7YqPkoRetsHFMaARs9dyzmP6jcT6qLQ";

const SHEET_MASTER = "master";
const SHEET_WEEKLY = "weekly";
const SHEET_MONTHLY = "monthly";
const SHEET_YEARLY = "yearly";
const SHEET_ACCESS_LOG = "access_log";
const SHEET_CONTACT = "contact";
const SHEET_COLLECTION = "collection";

const TZ = "Asia/Tokyo";


/**
 * =========================================================
 * GET API
 * =========================================================
 */

function doGet(e) {
  try {
    const mode = String((e && e.parameter && e.parameter.mode) || "").trim();

    if (mode === "ranking") {
      return jsonOut_({
        ranking: buildAccessRanking_()
      });
    }

    if (mode === "collection-count") {
      return jsonOut_(getCollectionCount_(String(e.parameter.sleeveId || "").trim()));
    }

    const start = Date.now();
    const sleeves = buildSleevesData_();
    console.log("API total time: " + (Date.now() - start) + " ms");

    return jsonOut_({
      sleeves: sleeves
    });
  } catch (err) {
    console.error(err);
    return jsonOut_({
      error: String(err && err.message ? err.message : err)
    });
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents
      ? e.postData.contents
      : "{}";

    const body = JSON.parse(raw);
    const action = String(body.action || "").trim();

    if (action === "access") {
      appendAccessLog_(body);
      return jsonOut_({ ok: true });
    }

    if (action === "contact") {
      appendContact_(body);
      return jsonOut_({ ok: true });
    }

    if (action === "collection_sync") {
      return jsonOut_(syncCollection_(body));
    }

    return jsonOut_({
      ok: false,
      error: "unknown action",
      message: "unknown action"
    });
  } catch (err) {
    console.error(err);
    return jsonOut_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      message: String(err && err.message ? err.message : err)
    });
  }
}

function getOrCreateAccessLogSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_ACCESS_LOG);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ACCESS_LOG);
    sheet.appendRow([
      "timestamp", "date", "sleeveId", "id", "sleeveName",
      "page", "path", "referrer", "userAgent", "userId"
    ]);
    return sheet;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  if (!headers.includes("sleeveName")) {
    sheet.insertColumnAfter(4);
    sheet.getRange(1, 5).setValue("sleeveName");
  }

  return sheet;
}

function appendAccessLog_(body) {
  const sheet = getOrCreateAccessLogSheet_();
  const now = new Date();

  const sleeveId = String(body.sleeveId || body.id || "").trim();
  const sleeveName = String(body.sleeveName || body.name || "").trim();

  if (!sleeveId) {
    throw new Error("sleeveId is required");
  }

  sheet.appendRow([
    now,
    Utilities.formatDate(now, TZ, "yyyy-MM-dd"),
    sleeveId,
    String(body.id || sleeveId),
    sleeveName,
    String(body.page || ""),
    String(body.path || ""),
    String(body.referrer || ""),
    String(body.userAgent || ""),
    String(body.userId || "")
  ]);
}

function getOrCreateContactSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_CONTACT);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CONTACT);
    sheet.appendRow([
      "timestamp",
      "date",
      "name",
      "subject",
      "message",
      "page",
      "status"
    ]);
  }

  return sheet;
}

function appendContact_(body) {
  const sheet = getOrCreateContactSheet_();
  const now = new Date();

  const name = String(body.name || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !subject || !message) {
    throw new Error("name, subject, message are required");
  }

  sheet.appendRow([
    now,
    Utilities.formatDate(now, TZ, "yyyy-MM-dd"),
    name,
    subject,
    message,
    String(body.page || ""),
    String(body.status || "new")
  ]);
}

function buildAccessRanking_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_ACCESS_LOG);

  if (!sheet || sheet.getLastRow() <= 1) {
    return [];
  }

  const values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues();

  const counts = new Map();

  values.forEach(function(row) {
    const sleeveId = String(row[2] || row[3] || "").trim();

    if (!sleeveId) {
      return;
    }

    counts.set(sleeveId, (counts.get(sleeveId) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(function(entry) {
      return {
        sleeveId: entry[0],
        id: entry[0],
        access: entry[1]
      };
    })
    .sort(function(a, b) {
      return b.access - a.access;
    });
}


/**
 * =========================================================
 * 全データ生成
 * =========================================================
 */

function buildSleevesData_() {

  const totalStart = Date.now();

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  /**
   * シート取得
   */

  const masterSh =
    ss.getSheetByName(
      SHEET_MASTER
    );

  const weeklySh =
    ss.getSheetByName(
      SHEET_WEEKLY
    );

  const monthlySh =
    ss.getSheetByName(
      SHEET_MONTHLY
    );

  const yearlySh =
    ss.getSheetByName(
      SHEET_YEARLY
    );


  /**
   * シート存在確認
   */

  if (!masterSh) {
    throw new Error(
      "masterシートが見つかりません"
    );
  }

  if (!weeklySh) {
    throw new Error(
      "weeklyシートが見つかりません"
    );
  }

  if (!monthlySh) {
    throw new Error(
      "monthlyシートが見つかりません"
    );
  }

  if (!yearlySh) {
    throw new Error(
      "yearlyシートが見つかりません"
    );
  }


  /**
   * =====================================================
   * master
   * =====================================================
   */

  let start = Date.now();

  const masterRows =
    readTableByHeader_(
      masterSh
    );

  console.log(
    "master: " +
    masterRows.length +
    " rows / " +
    (Date.now() - start) +
    " ms"
  );


  /**
   * =====================================================
   * weekly
   * =====================================================
   */

  start = Date.now();

  const weeklyById =
    readWeeklyById_(
      weeklySh
    );

  console.log(
    "weekly read/build: " +
    (Date.now() - start) +
    " ms"
  );


  /**
   * =====================================================
   * monthly
   * =====================================================
   */

  start = Date.now();

  const monthlyById =
    readMonthlyById_(
      monthlySh
    );

  console.log(
    "monthly read/build: " +
    (Date.now() - start) +
    " ms"
  );


  /**
   * =====================================================
   * yearly
   * =====================================================
   */

  start = Date.now();

  const yearlyData =
    readYearlyData_(
      yearlySh
    );

  console.log(
    "yearly read/build: " +
    (Date.now() - start) +
    " ms"
  );


  const yearlyById =
    yearlyData.yearlyById;

  const pricesByYearById =
    yearlyData.pricesByYearById;


  /**
   * =====================================================
   * master + 相場情報
   * =====================================================
   */

  start = Date.now();

  const sleeves = [];


  for (
    let i = 0;
    i < masterRows.length;
    i++
  ) {

    const r =
      masterRows[i];


    const id =
      toStr_(
        r.id
      );


    if (!id) {
      continue;
    }


    /**
     * カテゴリ
     */

    const pokemonCategories =
      collectCategoryRange_(
        r,
        1,
        3
      );


    const trainerCategories =
      collectCategoryRange_(
        r,
        4,
        5
      );


    const categoryTags =
      collectCategoryRange_(
        r,
        6,
        9
      );


    const categories =
      uniqueArray_(

        pokemonCategories.concat(
          trainerCategories,
          categoryTags
        )

      );


    /**
     * feature
     */

    const feature =
      toStr_(
        r.type
      );


    /**
     * 画像
     */

    const imageUrl =

      toStr_(

        r.imageurl ||

        r.image ||

        r.img

      )

      ||

      driveImageUrlFromFileId_(

        r.imagefileid ||

        r.fileid

      );


    /**
     * 価格データ
     */

    const weeklyPrices =
      weeklyById.get(id)
      || [];


    const monthlyPrices =
      monthlyById.get(id)
      || [];


    const yearlyPrices =
      yearlyById.get(id)
      || [];


    const pricesByYear =
      pricesByYearById.get(id)
      || {};


    /**
     * masterデータ
     */

    sleeves.push({

      id:
        id,


      name:
        toStr_(
          r.name
        ),


      imageUrl:
        imageUrl,


      releaseDate:
        normalizeMasterDate_(

          r.releaseyear ||

          r.release ||

          r.year

        ),


      releaseYear:
        extractYear_(

          r.releaseyear ||

          r.release ||

          r.year

        ),


      firstPrice:
        toNumberOrNull_(
          r.firstprice
        ),


      series:
        toStr_(
          r.series
        ),


      condition:
        toStr_(
          r.condition
        ),


      type:
        feature,


      feature:
        feature,


      acquisitionType:
        toStr_(
          r.acquisitiontype
        ),


      illustrator:
        toStr_(
          r.illustrator
        ),


      note:
        toStr_(
          r.note
        ),


      category1:
        toStr_(
          r.category1
        ),


      category2:
        toStr_(
          r.category2
        ),


      category3:
        toStr_(
          r.category3
        ),


      category4:
        toStr_(
          r.category4
        ),


      category5:
        toStr_(
          r.category5
        ),


      category6:
        toStr_(
          r.category6
        ),


      category7:
        toStr_(
          r.category7
        ),


      category8:
        toStr_(
          r.category8
        ),


      category9:
        toStr_(
          r.category9
        ),


      pokemonCategories:
        pokemonCategories,


      trainerCategories:
        trainerCategories,


      categoryTags:
        categoryTags,


      categories:
        categories,


      weeklyPrices:
        weeklyPrices,


      monthlyPrices:
        monthlyPrices,


      yearlyPrices:
        yearlyPrices,


      pricesByYear:
        pricesByYear

    });

  }


  console.log(
    "master merge: " +
    (Date.now() - start) +
    " ms"
  );


  console.log(
    "TOTAL: " +
    (Date.now() - totalStart) +
    " ms"
  );


  console.log(
    "Sleeves: " +
    sleeves.length
  );


  return sleeves;

}


/**
 * =========================================================
 * WEEKLY高速読み込み
 * =========================================================
 *
 * 必要列
 *
 * id
 * week
 * price
 * count
 *
 * name等はAPIでは不要なので処理しない
 */

function readWeeklyById_(sheet) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  const map =
    new Map();


  if (
    lastRow <= 1 ||
    lastColumn < 1
  ) {

    return map;

  }


  /**
   * ヘッダー
   */

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        normalizeHeaderKey_
      );


  const idCol =
    headers.indexOf("id");


  const weekCol =
    headers.indexOf("week");


  const priceCol =
    headers.indexOf("price");


  const countCol =
    headers.indexOf("count");


  if (
    idCol === -1 ||
    weekCol === -1 ||
    priceCol === -1
  ) {

    throw new Error(
      "weeklyに id / week / price が必要です"
    );

  }


  /**
   * 一括読み込み
   */

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getValues();


  /**
   * ID別に直接Map化
   *
   * 一度オブジェクト配列を作らないので軽い
   */

  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const id =
      toStr_(
        row[idCol]
      );


    if (!id) {
      continue;
    }


    if (
      !map.has(id)
    ) {

      map.set(
        id,
        []
      );

    }


    map
      .get(id)
      .push({

        week:
          fastDate_(
            row[weekCol]
          ),


        price:
          toNumberOrNull_(
            row[priceCol]
          ),


        count:
          countCol >= 0
            ? toNumberOrNull_(
                row[countCol]
              )
            : null

      });

  }


  /**
   * weeklyを時系列順
   */

  map.forEach(
    (items) => {

      items.sort(
        (a, b) =>
          String(a.week)
            .localeCompare(
              String(b.week)
            )
      );

    }
  );


  return map;

}


/**
 * =========================================================
 * MONTHLY高速読み込み
 * =========================================================
 *
 * 対応列
 *
 * id
 * month
 * price
 * count
 * source
 * shop
 * note
 */

function readMonthlyById_(sheet) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  const map =
    new Map();


  if (
    lastRow <= 1 ||
    lastColumn < 1
  ) {

    return map;

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        normalizeHeaderKey_
      );


  const idCol =
    headers.indexOf("id");

  const monthCol =
    headers.indexOf("month");

  const priceCol =
    headers.indexOf("price");

  const countCol =
    headers.indexOf("count");

  const sourceCol =
    headers.indexOf("source");

  const shopCol =
    headers.indexOf("shop");

  const noteCol =
    headers.indexOf("note");


  if (
    idCol === -1 ||
    monthCol === -1 ||
    priceCol === -1
  ) {

    throw new Error(
      "monthlyに id / month / price が必要です"
    );

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const id =
      toStr_(
        row[idCol]
      );


    if (!id) {
      continue;
    }


    const price =
      toNumberOrNull_(
        row[priceCol]
      );


    if (
      price == null
    ) {

      continue;

    }


    if (
      !map.has(id)
    ) {

      map.set(
        id,
        []
      );

    }


    map
      .get(id)
      .push({

        month:
          fastDate_(
            row[monthCol]
          ),


        price:
          price,


        count:
          countCol >= 0
            ? toNumberOrNull_(
                row[countCol]
              )
            : null,


        source:
          sourceCol >= 0
            ? toStr_(
                row[sourceCol]
              )
            : "",


        shop:
          shopCol >= 0
            ? toStr_(
                row[shopCol]
              )
            : "",


        note:
          noteCol >= 0
            ? toStr_(
                row[noteCol]
              )
            : ""

      });

  }


  /**
   * 月順
   */

  map.forEach(
    (items) => {

      items.sort(
        (a, b) =>
          String(a.month)
            .localeCompare(
              String(b.month)
            )
      );

    }
  );


  return map;

}


/**
 * =========================================================
 * YEARLY高速読み込み
 * =========================================================
 */

function readYearlyData_(sheet) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  const yearlyById =
    new Map();


  const yearlyBuckets =
    new Map();


  if (
    lastRow <= 1 ||
    lastColumn < 1
  ) {

    return {

      yearlyById:
        yearlyById,

      pricesByYearById:
        new Map()

    };

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(
        normalizeHeaderKey_
      );


  const idCol =
    headers.indexOf("id");

  const yearCol =
    headers.indexOf("year");

  const priceCol =
    headers.indexOf("price");

  const countCol =
    headers.indexOf("count");


  if (
    idCol === -1 ||
    yearCol === -1 ||
    priceCol === -1
  ) {

    throw new Error(
      "yearlyに id / year / price が必要です"
    );

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const id =
      toStr_(
        row[idCol]
      );


    if (!id) {
      continue;
    }


    const year =
      extractYear_(
        row[yearCol]
      );


    const price =
      toNumberOrNull_(
        row[priceCol]
      );


    const count =
      countCol >= 0
        ? toNumberOrNull_(
            row[countCol]
          )
        : null;


    if (
      !year ||
      price == null
    ) {

      continue;

    }


    /**
     * yearlyPrices
     */

    if (
      !yearlyById.has(id)
    ) {

      yearlyById.set(
        id,
        []
      );

    }


    yearlyById
      .get(id)
      .push({

        year:
          year,

        price:
          price,

        count:
          count

      });


    /**
     * pricesByYear集計用
     */

    const key =
      id +
      "___" +
      year;


    if (
      !yearlyBuckets.has(key)
    ) {

      yearlyBuckets.set(
        key,
        []
      );

    }


    yearlyBuckets
      .get(key)
      .push({

        price:
          price,

        count:
          count

      });

  }


  /**
   * yearlyPricesソート
   */

  yearlyById.forEach(
    (items) => {

      items.sort(
        (a, b) =>
          Number(a.year)
          -
          Number(b.year)
      );

    }
  );


  /**
   * pricesByYear生成
   */

  const pricesByYearById =
    new Map();


  yearlyBuckets.forEach(
    (items, key) => {

      const separator =
        key.lastIndexOf(
          "___"
        );


      const id =
        key.substring(
          0,
          separator
        );


      const year =
        key.substring(
          separator + 3
        );


      const price =
        aggregatePriceItems_(
          items
        );


      if (
        price == null
      ) {

        return;

      }


      if (
        !pricesByYearById.has(
          id
        )
      ) {

        pricesByYearById.set(
          id,
          {}
        );

      }


      pricesByYearById
        .get(id)[year] =
          price;

    }
  );


  return {

    yearlyById:
      yearlyById,

    pricesByYearById:
      pricesByYearById

  };

}


/**
 * =========================================================
 * YEARLY価格集計
 * =========================================================
 */

function aggregatePriceItems_(items) {

  if (
    !items ||
    !items.length
  ) {

    return null;

  }


  let weightedSum = 0;

  let weightedCount = 0;

  let simpleSum = 0;

  let simpleCount = 0;

  let hasWeight = false;


  for (
    let i = 0;
    i < items.length;
    i++
  ) {

    const price =
      toNumberOrNull_(
        items[i].price
      );


    const count =
      toNumberOrNull_(
        items[i].count
      );


    if (
      price == null
    ) {

      continue;

    }


    if (
      count != null &&
      count > 0
    ) {

      weightedSum +=
        price *
        count;


      weightedCount +=
        count;


      hasWeight =
        true;


    } else {

      simpleSum +=
        price;


      simpleCount++;

    }

  }


  if (
    hasWeight &&
    weightedCount > 0
  ) {

    if (
      simpleCount > 0
    ) {

      weightedSum +=
        simpleSum;


      weightedCount +=
        simpleCount;

    }


    return (
      weightedSum /
      weightedCount
    );

  }


  if (
    simpleCount > 0
  ) {

    return (
      simpleSum /
      simpleCount
    );

  }


  return null;

}


/**
 * =========================================================
 * MASTER読み込み
 * =========================================================
 */

function readTableByHeader_(sheet) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  if (
    lastRow <= 1 ||
    lastColumn < 1
  ) {

    return [];

  }


  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();


  const headers =
    values[0].map(
      normalizeHeaderKey_
    );


  const rows = [];


  for (
    let r = 1;
    r < values.length;
    r++
  ) {

    const obj = {};

    let hasData =
      false;


    for (
      let c = 0;
      c < headers.length;
      c++
    ) {

      const key =
        headers[c];


      if (!key) {
        continue;
      }


      const value =
        values[r][c];


      obj[key] =
        value;


      if (
        value !== "" &&
        value !== null
      ) {

        hasData =
          true;

      }

    }


    if (
      hasData
    ) {

      rows.push(
        obj
      );

    }

  }


  return rows;

}


/**
 * =========================================================
 * 日付高速変換
 * =========================================================
 *
 * weekly / monthlyの大量データで
 * Utilities.formatDateを使わない
 */

function fastDate_(v) {

  if (
    v instanceof Date &&
    !isNaN(
      v.getTime()
    )
  ) {

    const year =
      v.getFullYear();


    const month =
      String(
        v.getMonth() + 1
      ).padStart(
        2,
        "0"
      );


    const day =
      String(
        v.getDate()
      ).padStart(
        2,
        "0"
      );


    return (
      year +
      "-" +
      month +
      "-" +
      day
    );

  }


  return String(
    v == null
      ? ""
      : v
  ).trim();

}


/**
 * =========================================================
 * master日付
 * =========================================================
 */

function normalizeMasterDate_(v) {

  if (
    v instanceof Date &&
    !isNaN(
      v.getTime()
    )
  ) {

    return Utilities.formatDate(
      v,
      TZ,
      "yyyy-MM-dd"
    );

  }


  return String(
    v == null
      ? ""
      : v
  ).trim();

}


/**
 * =========================================================
 * 年取得
 * =========================================================
 */

function extractYear_(v) {

  if (
    v instanceof Date &&
    !isNaN(
      v.getTime()
    )
  ) {

    return v.getFullYear();

  }


  const s =
    String(
      v || ""
    ).trim();


  if (!s) {
    return null;
  }


  if (
    /^\d{4}$/.test(
      s
    )
  ) {

    return Number(
      s
    );

  }


  const match =
    s.match(
      /\b(19|20)\d{2}\b/
    );


  if (match) {

    return Number(
      match[0]
    );

  }


  return null;

}


/**
 * =========================================================
 * カテゴリ
 * =========================================================
 */

function collectCategoryRange_(
  row,
  startNum,
  endNum
) {

  const list = [];


  for (
    let i = startNum;
    i <= endNum;
    i++
  ) {

    const value =
      toStr_(
        row[
          "category" + i
        ]
      );


    if (value) {

      list.push(
        value
      );

    }

  }


  return uniqueArray_(
    list
  );

}


/**
 * =========================================================
 * 重複削除
 * =========================================================
 */

function uniqueArray_(arr) {

  return [
    ...new Set(
      arr
    )
  ];

}


/**
 * =========================================================
 * Drive画像URL
 * =========================================================
 */

function driveImageUrlFromFileId_(
  fileId
) {

  const id =
    toStr_(
      fileId
    );


  if (!id) {
    return "";
  }


  return (
    "https://drive.google.com/thumbnail?id=" +
    encodeURIComponent(id) +
    "&sz=w1200"
  );

}


/**
 * =========================================================
 * ヘッダー正規化
 * =========================================================
 */

function normalizeHeaderKey_(h) {

  return String(
    h || ""
  )

    .trim()

    .toLowerCase()

    .replace(
      /\s+/g,
      ""
    )

    .replace(
      /[^a-z0-9_]/g,
      ""
    );

}


/**
 * =========================================================
 * 数値
 * =========================================================
 */

function toNumberOrNull_(v) {

  if (
    v === "" ||
    v == null
  ) {

    return null;

  }


  const n =
    Number(
      v
    );


  return Number.isFinite(
    n
  )
    ? n
    : null;

}


/**
 * =========================================================
 * 文字列
 * =========================================================
 */

function toStr_(v) {

  return String(
    v == null
      ? ""
      : v
  ).trim();

}


/**
 * =========================================================
 * JSON
 * =========================================================
 */

function jsonOut_(obj) {

  return ContentService

    .createTextOutput(
      JSON.stringify(
        obj
      )
    )

    .setMimeType(
      ContentService
        .MimeType
        .JSON
    );

}


/**
 * =========================================================
 * master単体テスト
 * =========================================================
 */

function testMasterOnly() {

  const start =
    Date.now();


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      SHEET_MASTER
    );


  const rows =
    readTableByHeader_(
      sheet
    );


  console.log(
    "master rows = " +
    rows.length
  );


  console.log(
    "master time = " +
    (Date.now() - start) +
    " ms"
  );

}


/**
 * =========================================================
 * weekly単体テスト
 * =========================================================
 */

function testWeeklyOnly() {

  const start =
    Date.now();


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      SHEET_WEEKLY
    );


  const data =
    readWeeklyById_(
      sheet
    );


  console.log(
    "weekly IDs = " +
    data.size
  );


  console.log(
    "weekly time = " +
    (Date.now() - start) +
    " ms"
  );

}


/**
 * =========================================================
 * monthly単体テスト
 * =========================================================
 */

function testMonthlyOnly() {

  const start =
    Date.now();


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      SHEET_MONTHLY
    );


  const data =
    readMonthlyById_(
      sheet
    );


  console.log(
    "monthly IDs = " +
    data.size
  );


  console.log(
    "monthly time = " +
    (Date.now() - start) +
    " ms"
  );

}


/**
 * =========================================================
 * yearly単体テスト
 * =========================================================
 */

function testYearlyOnly() {

  const start =
    Date.now();


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      SHEET_YEARLY
    );


  const data =
    readYearlyData_(
      sheet
    );


  console.log(
    "yearly IDs = " +
    data.yearlyById.size
  );


  console.log(
    "yearly time = " +
    (Date.now() - start) +
    " ms"
  );

}


/**
 * =========================================================
 * 全体テスト
 * =========================================================
 */

function testAll() {

  const start =
    Date.now();


  const sleeves =
    buildSleevesData_();


  console.log(
    "========================="
  );


  console.log(
    "Sleeves = " +
    sleeves.length
  );


  console.log(
    "TOTAL = " +
    (Date.now() - start) +
    " ms"
  );


  console.log(
    "========================="
  );

}

function getOrCreateCollectionSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_COLLECTION);
  if (!sheet) sheet = ss.insertSheet(SHEET_COLLECTION);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["updatedAt", "userId", "sleeveId", "sleeveName", "quantity"]);
  }
  return sheet;
}

function syncCollection_(body) {
  const userId = String(body.userId || "").trim();
  if (!userId || userId.length > 120) throw new Error("valid userId is required");

  const source = Array.isArray(body.items) ? body.items : [];
  const byId = new Map();
  source.slice(0, 2000).forEach(function(item) {
    const sleeveId = String(item && (item.sleeveId || item.id) || "").trim();
    if (!sleeveId) return;
    byId.set(sleeveId, {
      sleeveId: sleeveId,
      sleeveName: String(item.name || item.sleeveName || "").trim().slice(0, 200),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
    });
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getOrCreateCollectionSheet_();
    const lastRow = sheet.getLastRow();
    const existing = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, 5).getValues()
      : [];
    const kept = existing.filter(function(row) {
      return String(row[1] || "").trim() !== userId;
    });
    const now = new Date();
    const added = Array.from(byId.values()).map(function(item) {
      return [now, userId, item.sleeveId, item.sleeveName, item.quantity];
    });
    const rows = kept.concat(added);
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    return { ok: true, synced: added.length };
  } finally {
    lock.releaseLock();
  }
}

function getCollectionCount_(sleeveId) {
  if (!sleeveId) return { ok: false, count: 0, error: "sleeveId is required" };
  const sheet = getOrCreateCollectionSheet_();
  if (sheet.getLastRow() <= 1) return { ok: true, sleeveId: sleeveId, count: 0 };
  const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues();
  const users = new Set();
  rows.forEach(function(row) {
    if (String(row[1] || "").trim() === sleeveId) users.add(String(row[0] || "").trim());
  });
  users.delete("");
  return { ok: true, sleeveId: sleeveId, count: users.size };
}
