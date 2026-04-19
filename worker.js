const {
    env,
    AutoProcessor,
    Gemma4ForConditionalGeneration,
    RawImage
} = require('@huggingface/transformers');

// WebGPUを有効化
env.allowLocalModels = false;
env.useBrowserCache = true;

let model;
let processor;
const model_id = 'onnx-community/gemma-4-E2B-it-ONNX';

// 進捗の throttled update 用
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 500; // 0.5秒おきにトレイを更新

async function init() {
    console.log('Loading local model:', model_id);
    try {
        const check = typeof Gemma4ForConditionalGeneration;
        self.postMessage({ type: 'progress', payload: { status: 'status', text: `Init (Class:${check})` } });

        const progress_callback = (data) => {
            const now = Date.now();
            if (data.status === 'progress') {
                if (now - lastUpdateTime < UPDATE_INTERVAL) return;
                lastUpdateTime = now;
            }
            self.postMessage({ type: 'progress', payload: data });
        };

        // Cacheを完全に無効化してネットワークからリトライ
        env.useBrowserCache = false;

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Step 1: Fetching Configs...' } });
        processor = await AutoProcessor.from_pretrained(model_id, { revision: 'main' });
        
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
        await init();
    } else if (type === 'generate') {
        const { images, promptText } = payload;
        try {
            // ImageBitmapをRawImageに変換
            const rawImages = await Promise.all(images.map(async (img) => {
                const canvas = new OffscreenCanvas(img.width, img.height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                return new RawImage(new Uint8Array(imageData.data.buffer), img.width, img.height, 4);
            }));

            // チャットテンプレートの構築
            const content = images.map(() => ({ type: 'image' }));
            content.push({ type: 'text', text: promptText + "短い一言で実況してください。" });
            
            const messages = [{ role: 'user', content }];
            
            let prompt = await processor.apply_chat_template(messages, {
                add_generation_prompt: true,
                tokenize: false
            });
            
            // トークンの強制挿入
            const imageTag = processor.image_token || '<image>';
            if (images.length > 0 && !prompt.includes(imageTag)) {
                const placeholders = imageTag.repeat(images.length);
                prompt = prompt.replace(/(<start_of_turn>user\s*)/, `$1\n${placeholders}\n`);
            }
            
            const inputs = await processor(prompt, rawImages);
            
            const outputs = await model.generate({
                ...inputs,
                max_new_tokens: 64,
                do_sample: true,
                temperature: 0.7,
            });

            const decoded = processor.batch_decode(outputs, { skip_special_tokens: true });
            
            // 返答の抽出
            const reply = decoded[0].split('model\n').pop().trim();
            
            self.postMessage({ type: 'result', payload: { text: reply } });

            // テンソルの解放
            if (inputs) {
                Object.values(inputs).forEach((t) => t?.dispose?.());
            }
            if (outputs) outputs.dispose?.();

        } catch (error) {
            console.error('Inference error:', error);
            self.postMessage({ type: 'error', error: error.message });
        } finally {
            images.forEach(img => img.close());
        }
    }
};
