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

async function init() {
    console.log('Loading local model:', model_id);
    try {
        const progress_callback = (data) => {
            self.postMessage({ type: 'progress', payload: data });
        };

        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Loading processor...' } });
        processor = await AutoProcessor.from_pretrained(model_id);
        
        self.postMessage({ type: 'progress', payload: { status: 'status', text: 'Loading model (q4f16)...' } });
        model = await Gemma4ForConditionalGeneration.from_pretrained(model_id, {
            dtype: 'q4f16',
            device: 'webgpu',
            progress_callback
        });
        
        console.log('Model loaded via Gemma4ForConditionalGeneration (LOCAL)!');
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
            
            console.log('Final prompt:', prompt);
            
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
