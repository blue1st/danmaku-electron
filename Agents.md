## Gemma4モデルのガイドライン

基本的な使い方は以下の従う
* https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX
* https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX



## 映像解析のガイドライン

# On-device Multimodal Video Analysis with Transformers.js & Gemma 4

このドキュメントでは、`transformers.js` (v4+) と `Gemma 4 E2B/E4B` を使用して、ブラウザ上でローカルに動画解析（マルチモーダル推論）を実装する手法について解説します。

## 1. 構成概要

本プロジェクトでは、WebGPU を活用して端末上でリアルタイムに動画フレームを解析します。主なコンポーネントは以下の通りです。

- **Frontend (Main Thread)**: `getUserMedia` を用いた映像キャプチャと、`ImageBitmap` によるフレーム管理。
- **Worker (Background Thread)**: `@huggingface/transformers` を用いた重い推論処理。
- **Model**: `Gemma 4` シリーズのマルチモーダルモデル。

## 2. 実装のポイント

### A. 効率的なフレームキャプチャ (Frontend)

動画を「解析」するために、過去数秒間のフレームを `ImageBitmap` のバッファとして保持します。これにより、推論時に過去のコンテキスト（動きなど）をモデルに伝えることが可能になります。

```typescript
// フレームバッファの構築
let bitmapBuffer: ImageBitmap[] = [];
const videoFrameCount = 8; // 解析に使うフレーム数

async function updateFrameBuffer() {
  const maxSize = 448; // モデルの入力サイズに合わせてリサイズ（メモリ節約）
  const bitmap = await captureSingleFrameBitmap({ maxSize });
  if (bitmap) {
    bitmapBuffer.push(bitmap);
    if (bitmapBuffer.length > videoFrameCount) {
      const old = bitmapBuffer.shift();
      old?.close(); // メモリを明示的に解放
    }
  }
}
```

### B. Worker へのデータ転送 (Zero-copy)

`ImageBitmap` は `postMessage` の `transferable` オブジェクトとして転送可能です。これにより、メインスレッドとワーカースレッド間での巨大なピクセルデータのコピーを回避し、パフォーマンスを向上させます。

```typescript
// メインスレッドから Worker へ送信
worker.postMessage({
  type: 'generate',
  payload: {
    images: frames, // ImageBitmap[]
    promptText: "何が映っていますか？"
  }
}, frames); // Transferable objects
```

### C. Worker での画像処理と推論

Worker 内では `OffscreenCanvas` を使用して `ImageBitmap` を `RawImage` (Transformers.js の形式) に変換します。

```typescript
// Worker内での処理
const canvas = new OffscreenCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imageData = ctx.getImageData(0, 0, w, h);
const rawImage = new RawImage(new Uint8Array(imageData.data.buffer), w, h, 4);
```

### D. プロンプト構成と Chat Template

マルチフレーム（動画）解析を行う場合、`<image>` トークンをフレーム数分だけプロンプトに挿入する必要があります。

```typescript
const imageTag = processor.image_token || '<image>';
// フレーム数分だけタグを繰り返す
const placeholders = imageTag.repeat(images.length);
// プロンプトの先頭（または適切な場所）に挿入
prompt = prompt.replace(/(<start_of_turn>user\s*)/, `$1\n${placeholders}\n`);
```

### E. メモリ管理 (GPU Resources)

WebGPU を使用する場合、推論に使用したテンソルを明示的に解放しないと VRAM が枯渇します。`dispose()` メソッドを必ず呼び出すようにします。

```typescript
try {
  const inputs = await processor(prompt, images);
  const outputs = await model.generate({ ...inputs });
  // ...
} finally {
  // テンソルの解放
  if (inputs) {
    Object.values(inputs).forEach((t: any) => t?.dispose?.());
  }
  if (outputs) outputs.dispose?.();
}
```

## 3. トラブルシューティング

- **Out of Memory (OOM)**: モバイルブラウザでは極端に GPU メモリ制限が厳しいため、フレーム数を減らすか、`lowResource` モード（解像度を下げる等）を実装してください。
