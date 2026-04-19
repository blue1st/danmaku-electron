# Danmaku Electron (Gemma Live)

<p align="center">
  <img src="assets/icon.png" width="200" height="200" alt="Danmaku Electron Icon">
</p>


## 概要
デスクトップ画面をAIがリアルタイムに実況・状況解説する、弾幕風デスクトップ常駐アプリです。
最先端のマルチモーダルAI「Gemma 4」を WebGPU を活用して端末ローカルで動作させ、画面キャプチャに基づいた生々しいリアクションを画面上にオーバーレイ表示します。

- **100% ローカル実行**: クラウドAPIを使わず、プライバシーを保ちながら高速に推論。
- **マルチキャラクター**: 起動ごとにランダムに選ばれる6〜12人の個性豊かなキャラクターが、それぞれの視点でボヤいたり驚いたりします。
- **高機能システムトレイ**: 画面の表示/非表示、解析頻度の調整、AIモデルの切り替え（E2B / E4B）を直感的に行えます。
- **透過・クリック透過**: 作業を邪魔しない透明なレイヤーで動作します。

## 主要機能
- **リアルタイム画面実況**: 画面の変化を捉えて、キャラクターになりきってコメントを生成。
- **選べるAIモデル**:
  - **Gemma 4 E2B**: 軽量・高速。省リソース環境向け。
  - **Gemma 4 E4B**: 高精度・多弁。高い表現力を求める環境向け。
- **柔軟な解析設定**: 推論の間隔（5秒〜40秒）を負荷に合わせて手元で調整可能。
- **リッチなスプラッシュ画面**: モデルのダウンロードやコンパイルの進捗をビジュアル表示。

## 必要環境
- **OS**: macOS (Apple Silicon 推奨) / Windows (WebGPU 対応環境)
- **GPU**: WebGPU 対応の GPU（モデル実行に数GBのVRAMを消費します）
- **Node.js**: v18 以上

## インストール手順

### Homebrew (macOS)
```bash
brew install blue1st/taps/danmaku-electron
```

### Windows
GitHub の [Releases](https://github.com/blue1st/danmaku-electron/releases) ページから最新の `.exe` インストーラーをダウンロードして実行してください。

### ソースコードから
```bash
git clone https://github.com/blue1st/danmaku-electron.git
cd danmaku-electron
npm install
```

## 使い方
### アプリ起動
```bash
npm start
```

1. 起動するとシステムトレイにアイコンが表示されます。
2. 初回起動時は AI モデル（約 2GB〜4GB）のダウンロードが行われます。
3. ロード完了後、自動的に画面キャプチャの許可を求められます。許可すると実況が開始されます。

### トレイメニュー
- **画面を表示**: チェックを入れるとコメントが流れます。
- **解析頻度**: AI がどのくらいの頻度で画面を見るかを設定します。
- **AI モデル**: E2B (軽量) と E4B (高精度) を切り替えます（変更後、自動で再起動します）。

## ビルド・リリース
### パッケージ作成
```bash
npm run dist
```
`dist/` ディレクトリに各プラットフォーム用のインストーラーが生成されます。

### リリース
```bash
npm run release
```
`release-it` によりバージョン更新、タグ付け、GitHub Release 作成を自動行います。

## 技術スタック
- **Frontend**: HTML5 / CSS3 / JavaScript
- **Backend**: Electron
- **AI Inference**: Transformers.js (v4+) + WebGPU
- **Model**: Google Gemma 4 (E2B / E4B ONNX)

## ライセンス
MIT License
