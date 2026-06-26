# DiagramForge AI 契約 — `.cde` とライブ編集

エージェント（Cursor / MCP / スクリプト）が DiagramForge を触るときの **実装準拠** の契約書です。

| ドキュメント | 役割 |
|-------------|------|
| **本書（AUTO.md）** | 日本語の AI 契約・MCP / `window.DF` 操作 |
| **[Web/SCHEMA.md](Web/SCHEMA.md)** | `.cde` スキーマ詳細（英語・リンク属性など） |
| **[USAGE.md](USAGE.md)** | dev server・Phase 2/3/4・MCP セットアップ（英語） |

Canonical English schema for link `corner` / anchor behaviour: **SCHEMA.md**.

**方針（開発中）:** 古いフィールド名の正規化や互換レイヤは **ない**。スキーマ外の JSON はそのまま読み込むか、検証で弾く。意図的に壊れやすくして差分に気づく。

---

## ルートオブジェクト（`.cde` ファイル）

```json
{
	"model": {
		"nodes": [ … ],
		"links": [ … ]
	},
	"canvasWidth": 4096,
	"canvasHeight": 4096
}
```

| フィールド | 説明 |
|-----------|------|
| **`model.nodes`** | ノード配列（描画順 ≒ z-order。後ろほど手前） |
| **`model.links`** | リンク配列 |
| **`canvasWidth` / `canvasHeight`** | 省略可。省略時はノードの BBox から算出、空なら 4096×4096 |

座標系: 原点左上、**Y 軸下向き**。

`Load()`（`Web/Application.js`）は `{ model, canvasWidth, canvasHeight }` をそのまま `app.model` に載せ替える。**レガシー名の読み替えはしない。**

---

## ノード `[ ID, shape, paint ]`

| index | 名前 | 内容 |
|-------|------|------|
| `0` | **`ID`** | 一意な文字列。リンクはこの ID で参照 |
| `1` | **`shape`** | 形状・ラベル（下表） |
| `2` | **`paint`** | Canvas 2D スタイル（省略可 `{}`） |

### `shape`

| フィールド | 必須 | 説明 |
|-----------|------|------|
| **`type`** | ✓ | `"rect"` \| `"ellipse"` \| `"rhombus"` \| `"SVG"` \| `"PNG"` |
| **`cX`, `cY`** | ✓ | 中心座標（数値）。**`cx`/`cy` ではない** |
| **`rH`, `rV`** | ✓ | 半幅 / 半高。実サイズ ≈ `2×|rH|` × `2×|rV|` |
| **`radii`** | — | `rect` の角丸 |
| **`html`** | — | ラベル HTML（`foreignObject`）。**`innerHTML` ではない** |
| **`style`** | — | ラベル用 CSS 断片（`;prop : value` 改行区切り） |
| **`SVG`** | type=SVG | SVG ソース文字列（アプリ内で base64 化して描画） |
| **`PNG`** | type=PNG | PNG の base64 |

ジオメトリ: `x = cX − rH`, `y = cY − rV`, `width = 2×rH`, `height = 2×rV`。

### `paint`（ノード・リンク共通）

適用されるキーのみ有効: `fill`, `stroke`, `lineWidth`, `lineCap`, `lineJoin`, `miterLimit`, `lineDash`, `lineDashOffset`。

---

## リンク `[ [ fromID, toID ], attributes, paint ]`

| index | 名前 | 内容 |
|-------|------|------|
| `0` | **エンドポイント** | `[ fromID, toID ]` 文字列の組 |
| `1` | **`attributes`** | 矢印・接続・経路（下表） |
| `2` | **`paint`** | 線スタイル |

**旧形式 `[ A, B, direction, paint ]` や `direction: "<>"` は使わない。**

### `attributes`

| キー | 値 | 説明 |
|------|-----|------|
| **`headF`, `headT`** | `false` / 省略 / スタイル名 | 始点・終点の矢印。スタイル: `triangle`, `open`, `hollow`, `diamond`, `diamondHollow`, `circle`, `circleHollow` |
| **`anchorF`, `anchorT`** | `T` `B` `L` `R` `TL` `TR` `BL` `BR` / 省略 | 接続位置。省略 = 相手中心方向の外周交点 |
| **`corner`** | `bezier`（既定） / `sharp` / `arc` / `straight` | 直交ルートと角の描き方。詳細は SCHEMA.md |

同一 `[ from, to ]` のリンクは `Link()` / `EditLink()` で上書き。**重複は避ける**（`validate` が検出）。

---

## 手編集・ファイル編集のルール

1. **`rect` / `ellipse` / `rhombus` を優先。** 新規 base64 アイコンは明示要求時のみ。
2. **既存 `SVG` / `PNG` の base64 / ソース文字列は書き換えない。** 移動・リサイズは `cX`/`cY`/`rH`/`rV` と `ID` のみ。
3. **ノード ID を安定させる。** リンクは必ず存在する ID を参照。
4. **帯状レイアウト**（VPN, Internet など）で `rV` を変えるときは、隣接フレームとの隙間を保つため **`cY` と下側ノード群の移動** をセットで考える。
5. **`updateNode`（API）は shape / paint の丸ごと置換。** パッチではない。変更前に必ず現状を読む。

---

## 検証（`validateModel` / `df_validate`）

`Web/ai-api.js` と `tools/df-validate.mjs` で同一ルール:

- ノード: `[ ID, shape, paint? ]`、`ID` 非空・重複なし、`type` あり、`cX`/`cY`/`rH`/`rV` は有限数値、幅・高さ > 5px
- リンク: `[ [ from, to ], attrs?, paint? ]`、from/to 存在、自己リンク・重複リンクはエラー

---

## プログラム API

### ブラウザ — `window.DF`（`Web/ai-api.js`）

`Application.js` 経由で **1 操作 = 1 undo ステップ**。

```js
DF.getModel()           // { nodes, links } の clone
DF.validate(model?)     // 問題の文字列配列（空 = OK）
DF.apply([ { op: '…', … }, … ])
DF.autoLayout({ algorithm: 'grid', cols, gap, startX, startY })
DF.setModel({ nodes, links })
```

**`apply` の op:**

| op | 主な引数 |
|----|---------|
| `addNode` | `id`, `area`, `paint?` |
| `updateNode` | `id`, `area`, `paint?`, `newId?` |
| `removeNode` | `id` |
| `restack` | `id`, `toFront?` |
| `addLink` | `from`, `to`, `ends?`, `paint?` |
| `updateLink` | `from`, `to`, `newFrom?`, `newTo?`, `ends?`, `paint?` |
| `removeLink` | `from`, `to` |
| `autoLayout` | grid オプション |
| `setCanvas` | `width`, `height` |

`area` = 上記 **`shape`** オブジェクト。`ends` = リンク **`attributes`**。

### MCP — `diagramforge` サーバ（`tools/df-mcp.mjs`）

| ツール | 用途 |
|--------|------|
| `df_status` | ブラウザ接続・watchPath |
| `df_get_model` | ライブ `{ model, canvasWidth, canvasHeight }` |
| `df_apply` | `{ ops: [ … ] }` — 上記 op と同じ |
| `df_validate` | 検証 |
| `df_auto_layout` | グリッド配置 |
| `df_load_file` / `df_save_file` | ブラウザロード / ディスク保存（`Web/` 相対） |
| `df_read_file` | ディスク読み（ブラウザ不要） |

**前提:** `npm run dev`、ブラウザタブ、`diagramforge` MCP を Enabled。手順は [USAGE.md](USAGE.md)。

### HTTP ブリッジ（Phase 3）

`tools/df-server.mjs` が提供:

- `GET /__df/status`
- `GET /__df/model`
- `POST /__df/rpc` — `{ "method": "apply", "params": { "ops": […] } }` など

---

## 編集経路の選び方

| やりたいこと | 経路 |
|-------------|------|
| `.cde` を保存したらブラウザに反映 | Phase 2 — `?cde=Samples/….cde` + ファイル保存 |
| チャットでライブに変える | Phase 4 — MCP `df_apply` |
| スクリプト・curl | Phase 3 — `/__df/rpc` |
| GitHub Pages のみ | `.cde` 手編集 + ↑ アップロード |

Phase 4 の変更は **`df_save_file` までディスクに残らない**。

---

## 関連コード

| ファイル | 内容 |
|---------|------|
| `Web/Application.js` | `Load`, `Node`, `EditNode`, `Link`, `SetModel`, undo |
| `Web/ai-api.js` | `window.DF`, `validateModel`, `apply` |
| `Web/geoDF.js` | リンク経路・矢印・フレームオフセット |
| `Web/main-editor.js` | 描画・コンテキストメニュー |
| `Web/ForeignLabel.js` | `html` ラベル |
| `tools/df-server.mjs` | 静的配信 + live reload + RPC |
| `tools/df-mcp.mjs` | Cursor MCP |
| `tools/df-validate.mjs` | ファイル / MCP 用検証 |

---

## 廃止済み（使わない）

次は **現行実装に存在しない**。ファイルに含まれていたら手で直す:

- ルートが `{ nodes, links }` のみ（`model` ラッパーなし）— 読み込みは `{ model }` 必須
- 座標 `cx` / `cy`、`innerHTML`、`div` タイプ
- リンク `[ A, B, direction, paint ]`、`direction: "<>"` / `"<"` / `">"`
- `PATH` ノードタイプ、`yellow` paint キー（描画未使用）
