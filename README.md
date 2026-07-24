# LumiVocab Adventure

イラスト・音声・例文・短時間ゲームで英単語を学ぶ、スマートフォン向けのオフライン対応Webアプリです。

## 主な機能

- 36語の英検5級〜準1級サンプルデータ
- 全単語にオリジナルSVGイラスト、発音、例文
- 冒険マップとステージ別クエスト
- 50秒の疑似オンライン対戦
- 苦手・うろ覚え・復習待ち・習得の自動分類
- 間隔反復の簡易スケジューリング
- 単語帳の音声連続再生
- 連続記録、XP、レベル、週間グラフ
- JSONの書き出し・読み込み
- localStorage保存、PWAキャッシュ

## GitHub Pagesで公開

1. ZIPを解凍します。
2. 解凍後のフォルダ内にある `index.html`、`styles.css`、`app.js`、`data`、`assets`、`manifest.webmanifest`、`sw.js`、`README.md` を、そのままGitHubリポジトリ直下へアップロードします。
3. リポジトリ名は `lumi-vocab-adventure` を推奨します。
4. GitHubの Settings → Pages → Deploy from a branch → `main` / `(root)` を選びます。

ZIPファイル自体をGitHubへ置くのではなく、解凍した中身をアップロードしてください。

## JSON追加形式

```json
[
  {
    "id": "unique-id",
    "word": "example",
    "meaning": "例",
    "phonetic": "/ɪɡˈzæmpəl/",
    "example": "This is an example.",
    "exampleJa": "これは例です。",
    "level": "英検2級",
    "stage": 4,
    "illustration": "book"
  }
]
```

`illustration` は既存単語の値を流用できます。独自イラストを追加する場合は `app.js` の `illustration()` にSVGテンプレートを追加してください。

## 注意

本作は学習ゲームの一般的な構造を参考にしたオリジナル実装です。他社アプリの名称、ロゴ、キャラクター、画像、文章、画面デザインは使用していません。リアルタイム対人戦やクラウド同期には別途バックエンドが必要です。
