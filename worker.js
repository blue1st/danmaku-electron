// WebGPUを有効化するための初期インポート（設定はinit内で行う）
// Windows環境などでSharpのネイティブモジュールが読み込めない問題を回避するためのモック
try {
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (path) {
        if (path === 'sharp') {
            throw new Error('Sharp is disabled to avoid native module issues in Electron.');
        }
        return originalRequire.apply(this, arguments);
    };
} catch (e) {
    console.warn('Failed to mock sharp:', e);
}

const {
    env,
    AutoProcessor,
    Gemma4ForConditionalGeneration,
    RawImage
} = require('@huggingface/transformers');

let model;
let processor;
// 進捗の throttled update 用
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 500; // 0.5秒おきにトレイを更新

async function init(payload) {
    const { modelId, userDataPath } = payload;
    const model_id = modelId || 'onnx-community/gemma-4-E2B-it-ONNX';

    // 環境設定の初期化
    env.allowLocalModels = false;
    env.useBrowserCache = false; // Electronではディスクキャッシュ（userData）を優先

    if (userDataPath) {
        const path = require('path');
        const cachePath = path.join(userDataPath, 'models-cache');
        console.log('Setting cache path:', cachePath);
        env.cacheDir = cachePath;
        // Node環境でのローカルパスも一応設定
        env.localModelPath = cachePath;
    }

    console.log('Loading local model:', model_id);
    try {
        const check = typeof Gemma4ForConditionalGeneration;
        self.postMessage({ type: 'progress', payload: { status: 'status', text: `Init (Model:${model_id.split('/').pop()})` } });

        const progress_callback = (data) => {
            const now = Date.now();
            if (data.status === 'progress') {
                if (now - lastUpdateTime < UPDATE_INTERVAL) return;
                lastUpdateTime = now;
            }
            self.postMessage({ type: 'progress', payload: data });
        };

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Step 1: Fetching Configs...' } });
        processor = await AutoProcessor.from_pretrained(model_id, {
            revision: 'main',
            progress_callback
        });

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Step 2: Checking WebGPU...' } });
        if (!navigator.gpu) {
            throw new Error('WebGPU is not supported');
        }

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Step 3: Loading Weights...' } });
        model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, {
            dtype: 'q4f16',
            device: 'webgpu',
            revision: 'main',
            progress_callback
        });

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Step 4: Compiling...' } });
        console.log('Model loaded successful!');
        self.postMessage({ type: 'ready' });
    } catch (err) {
        console.error('Initialization failed:', err);
        self.postMessage({ type: 'error', error: err.message });
    }
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;
    if (type === 'init') {
        await init(payload);
    } else if (type === 'generate') {
        const { images, promptText, history, characterProfile } = payload;
        try {
            console.log('Generating comment with', images.length, 'images...');

            // ImageBitmapをRawImageに変換
            const rawImages = await Promise.all(images.map(async (img) => {
                const canvas = new OffscreenCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                return new RawImage(new Uint8Array(imageData.data.buffer), img.width, img.height, 4);
            }));

            // チャットテンプレートの構築
            let fullPrompt = `あなたは以下のキャラクターになりきり、デスクトップ画面のキャプチャや他の投稿を見て独り言やリアクションをしてください。
必ずキャラクターの設定（口調、性格、今の気分）を反映させ、ありきたりな表現やつまらない説明は避けてください。
文字数は短く（20文字以内）、そのキャラが言いそうな生々しい一言をお願いします。絵文字は使わないでください。

【キャラクター設定】: ${characterProfile}
【指令】: ${promptText}`;

            if (history && history.length > 0) {
                fullPrompt += `\n\n（※最近のチャット履歴：${history.join('、')}。これらを踏まえつつ、違う新しい表現を使ってください）`;
            }

            const content = images.map(() => ({ type: 'image' }));
            content.push({ type: 'text', text: fullPrompt });

            const messages = [{ role: 'user', content }];

            let prompt = await processor.apply_chat_template(messages, {
                add_generation_prompt: true,
                tokenize: false
            });

            // トークンの強制挿入（テンプレートが未対応の場合のバックアップ）
            const imageTag = processor.image_token || '<image>';
            if (images.length > 0 && !prompt.includes(imageTag)) {
                const placeholders = imageTag.repeat(images.length);
                prompt = prompt.replace(/(<start_of_turn>user\s*)/, `$1\n${placeholders}\n`);
            }

            console.log('Final Prompt:', prompt);
            const inputs = await processor(prompt, rawImages);

            const outputs = await model.generate({
                ...inputs,
                max_new_tokens: 48,
                do_sample: true,
                temperature: 0.7,
                top_p: 0.9,
                repetition_penalty: 1.1,
            });

            // プロンプト部分を除去してデコード
            const promptTokenCount = inputs.input_ids.dims[1];
            const decoded = processor.batch_decode(outputs.slice(null, [promptTokenCount, null]), {
                skip_special_tokens: true,
                clean_up_tokenization_spaces: true
            });

            let reply = decoded[0].trim();
            console.log('Generated Reply:', reply);

            // 何も生成されなかった場合の最終防衛ライン
            if (!reply) {
                // デコード全体を試して "model" で分割する旧来の方法をフォールバックとして試す
                const fullDecoded = processor.batch_decode(outputs, { skip_special_tokens: true });
                const parts = fullDecoded[0].split('model');
                reply = parts.length > 1 ? parts.pop().trim() : "";
                console.log('Fallback Slicing Reply:', reply);
            }

            self.postMessage({ type: 'result', payload: { text: reply } });

            // テンソルの解放
            if (inputs) {
                Object.values(inputs).forEach((t) => t?.dispose?.());
            }
            if (outputs) outputs.dispose?.();

        } catch (error) {
            console.error('Inference error detail:', error);
            self.postMessage({ type: 'error', error: `Inference failed: ${error.message}` });
        } finally {
            images.forEach(img => img.close());
        }
    }
};
